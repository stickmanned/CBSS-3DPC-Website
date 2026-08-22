import { Readable } from "node:stream";
import { createInflateRaw } from "node:zlib";
import { SaxesParser, type SaxesAttributeNS, type SaxesTagNS } from "saxes";
import type { UploadFormat } from "./upload-policy";
import { readObjectRange, StorageVerificationError } from "./r2";

const STL_BINARY_HEADER_BYTES = 84;
const STL_TRIANGLE_BYTES = 50;
const STRUCTURE_SAMPLE_BYTES = 64 * 1024;

const ZIP_LOCAL_HEADER_BYTES = 30;
const ZIP_CENTRAL_HEADER_BYTES = 46;
const ZIP_EOCD_BYTES = 22;
const ZIP_MAX_COMMENT_BYTES = 65_535;
const ZIP_RANGE_BYTES = 256 * 1024;
const ZIP_UTF8_FLAG = 0x0800;
// Bit 3. Slicers that stream their export (Bambu Studio and OrcaSlicer write
// project 3MFs this way) do not know an entry's CRC or size when they emit its
// local header, so they zero those three fields, set this flag, and repeat the
// values in a data descriptor after the compressed bytes. Refusing the flag
// refuses every archive written that way, which is most multicolour projects.
const ZIP_DATA_DESCRIPTOR_FLAG = 0x0008;
const ZIP_DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const ZIP_MAX_DATA_DESCRIPTOR_BYTES = 24;
const ZIP_ALLOWED_FLAGS = ZIP_UTF8_FLAG | ZIP_DATA_DESCRIPTOR_FLAG | 0x0006;

// ZIP64. Fusion 360, Bambu Studio, PrusaSlicer and Orca write these records
// into every 3MF they export, whatever its size, so a reader that rejects
// ZIP64 outright rejects most real models. Each oversized field is replaced
// by an all-ones sentinel and its true value moves into the 0x0001 extra
// field, in the fixed order uncompressed, compressed, local offset, disk.
// Consulting the extra ONLY for fields holding a sentinel, and only in that
// order, keeps the mapping unambiguous: no field can be given two values.
const ZIP64_EXTRA_ID = 0x0001;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const ZIP64_EOCD_LOCATOR_BYTES = 20;
const ZIP64_EOCD_BYTES = 56;
const ZIP64_EOCD_DECLARED_BYTES = ZIP64_EOCD_BYTES - 12;
const ZIP_MAX_VERSION_NEEDED = 45;
const U16_SENTINEL = 0xffff;
const U32_SENTINEL = 0xffffffff;

const MAX_CENTRAL_DIRECTORY_BYTES = 256 * 1024;
const MAX_3MF_ENTRIES = 512;
// Sized against the 50 MiB upload cap rather than picked round. Measured mesh
// XML from a slicer deflates around 3.5x, and the structured metadata beside it
// rather better, so a legal archive at the cap can reach a few hundred MiB
// inflated. The old 200 MiB ceiling turned that into a verification failure on
// a file the upload policy had already accepted. The ratio caps below, not
// these, are what stop a decompression bomb.
const MAX_3MF_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
const MAX_3MF_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;
const MAX_ENTRY_NAME_BYTES = 1_024;
const MAX_LOCAL_EXTRA_BYTES = 16 * 1024;
const MAX_XML_DEPTH = 128;
const MAX_XML_ATTRIBUTES = 256;
const MAX_XML_ELEMENTS = 5_000_000;
const MAX_XML_TOKEN_CHARS = 1024 * 1024;

const CONTENT_TYPES_NAMESPACE =
  "http://schemas.openxmlformats.org/package/2006/content-types";
const CORE_3MF_NAMESPACE =
  "http://schemas.microsoft.com/3dmanufacturing/core/2015/02";
const MODEL_3MF_CONTENT_TYPE =
  "application/vnd.ms-package.3dmanufacturing-3dmodel+xml";

/**
 * A namespace is treated as confirming evidence, not as a requirement. Demanding
 * the canonical URI rejects otherwise valid exporter output that omits the
 * declaration or moves it onto a prefix; ignoring the URI entirely would let any
 * ZIP holding a `.model` file pass as a 3MF. Accepting the canonical namespace
 * or none, and refusing a foreign one, keeps the check meaningful without making
 * it brittle.
 */
function namespaceAllows(uri: string, canonical: string): boolean {
  return uri === "" || uri === canonical;
}

type CentralEntry = {
  name: string;
  rawName: Uint8Array;
  flags: number;
  method: 0 | 8;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
};

type ArchiveEntry = CentralEntry & {
  dataStart: number;
  dataEnd: number;
  recordEnd: number;
};

function verificationFailure(reason = "unspecified"): never {
  throw new StorageVerificationError(reason);
}

/**
 * Realm-safe replacement for `value instanceof Uint8Array`. zlib hands back Node
 * Buffers, and instanceof is false across realms (jsdom, worker threads, vm
 * contexts) even though the value is a perfectly good byte view. Requiring a
 * one-byte element size excludes DataView and the wider typed arrays.
 */
function isByteView(value: unknown): value is Uint8Array {
  return (
    ArrayBuffer.isView(value) &&
    (value as { BYTES_PER_ELEMENT?: number }).BYTES_PER_ELEMENT === 1
  );
}

function uint32(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.length) verificationFailure();
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
    offset,
    true,
  );
}

function uint16(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 2 > bytes.length) verificationFailure();
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(
    offset,
    true,
  );
}

function uint64(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 8 > bytes.length) verificationFailure();
  const value = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getBigUint64(offset, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) verificationFailure();
  return Number(value);
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function containsBinaryControlBytes(bytes: Uint8Array): boolean {
  return bytes.some(
    (value) =>
      (value < 0x20 && value !== 0x09 && value !== 0x0a && value !== 0x0d) ||
      value === 0x7f,
  );
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    verificationFailure();
  }
}

async function assertStl(key: string, size: number): Promise<void> {
  const head = await readObjectRange(
    key,
    0,
    Math.min(size, STRUCTURE_SAMPLE_BYTES) - 1,
  );

  if (size >= STL_BINARY_HEADER_BYTES && head.length >= STL_BINARY_HEADER_BYTES) {
    const triangles = uint32(head, 80);
    const expectedSize = STL_BINARY_HEADER_BYTES + triangles * STL_TRIANGLE_BYTES;
    if (
      triangles > 0 &&
      Number.isSafeInteger(expectedSize) &&
      expectedSize === size
    ) {
      return;
    }
  }

  if (containsBinaryControlBytes(head)) verificationFailure();
  const headText = decodeUtf8(head);
  if (
    !/^\s*solid(?:\s|$)/i.test(headText) ||
    !/\bfacet\s+normal\b/i.test(headText) ||
    !/\bouter\s+loop\b/i.test(headText) ||
    (headText.match(/\bvertex\b/gi)?.length ?? 0) < 3
  ) {
    verificationFailure();
  }

  const tailStart = Math.max(0, size - 2_048);
  const tail = await readObjectRange(key, tailStart, size - 1);
  if (containsBinaryControlBytes(tail)) verificationFailure();
  const tailText = decodeUtf8(tail);
  if (!/\bendsolid(?:\s|$)/i.test(tailText)) verificationFailure();
}

class ArchiveReader {
  private cachedStart = -1;
  private cachedBytes: Uint8Array<ArrayBufferLike> = new Uint8Array();

  constructor(
    private readonly key: string,
    readonly size: number,
  ) {}

  async read(
    start: number,
    length: number,
    prefetch = true,
  ): Promise<Uint8Array<ArrayBufferLike>> {
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(length) ||
      start < 0 ||
      length < 1 ||
      start + length > this.size
    ) {
      verificationFailure();
    }

    const cachedEnd = this.cachedStart + this.cachedBytes.length;
    if (start >= this.cachedStart && start + length <= cachedEnd) {
      const relative = start - this.cachedStart;
      return this.cachedBytes.subarray(relative, relative + length);
    }

    const fetchLength = prefetch
      ? Math.min(this.size - start, Math.max(length, ZIP_RANGE_BYTES))
      : length;
    this.cachedBytes = await readObjectRange(
      this.key,
      start,
      start + fetchLength - 1,
    );
    this.cachedStart = start;

    if (this.cachedBytes.length !== fetchLength) verificationFailure();
    return this.cachedBytes.subarray(0, length);
  }

  async *chunks(
    start: number,
    length: number,
  ): AsyncGenerator<Uint8Array<ArrayBufferLike>> {
    let cursor = start;
    const end = start + length;
    while (cursor < end) {
      const chunkLength = Math.min(ZIP_RANGE_BYTES, end - cursor);
      yield await this.read(cursor, chunkLength, false);
      cursor += chunkLength;
    }
  }
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  for (let offset = bytes.length - ZIP_EOCD_BYTES; offset >= 0; offset -= 1) {
    if (
      uint32(bytes, offset) === 0x06054b50 &&
      offset + ZIP_EOCD_BYTES + uint16(bytes, offset + 20) === bytes.length
    ) {
      return offset;
    }
  }
  verificationFailure("zip-eocd-not-found");
}

function assertSafeArchivePath(filename: string): void {
  const parts = filename.split("/");
  const isDirectory = filename.endsWith("/");
  const pathParts = isDirectory ? parts.slice(0, -1) : parts;

  if (
    !filename ||
    filename !== filename.normalize("NFC") ||
    filename.startsWith("/") ||
    filename.includes("\\") ||
    filename.includes("\0") ||
    filename.includes(":") ||
    pathParts.length === 0 ||
    pathParts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        /[\u0000-\u001f\u007f]/.test(part),
    )
  ) {
    verificationFailure();
  }
}

/**
 * Walks the extra-field block, rejecting strong encryption outright and
 * returning the ZIP64 values a header's sentinels may need. Reading the block
 * rather than refusing it is what lets ordinary exporter output through; every
 * other structural check still applies to the values it yields.
 */
function parseExtraFields(bytes: Uint8Array): number[] {
  let offset = 0;
  let zip64: number[] | null = null;

  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) verificationFailure();
    const fieldId = uint16(bytes, offset);
    const fieldSize = uint16(bytes, offset + 2);
    // 0x9901 is the AES marker: an encrypted entry is never inspectable.
    if (fieldId === 0x9901) verificationFailure();
    if (offset + 4 + fieldSize > bytes.length) verificationFailure();

    if (fieldId === ZIP64_EXTRA_ID) {
      // A second ZIP64 block would make the sentinel mapping ambiguous.
      if (zip64) verificationFailure();
      const words = Math.floor(fieldSize / 8);
      // Only a trailing 4-byte disk-start field may follow the 8-byte values.
      const remainder = fieldSize - words * 8;
      if (remainder !== 0 && remainder !== 4) verificationFailure();
      zip64 = [];
      for (let index = 0; index < words; index += 1) {
        zip64.push(uint64(bytes, offset + 4 + index * 8));
      }
    }

    offset += 4 + fieldSize;
  }

  if (offset !== bytes.length) verificationFailure();
  return zip64 ?? [];
}

/**
 * Hands back the ZIP64 replacements in the order the specification fixes:
 * uncompressed size, compressed size, local header offset. A sentinel with no
 * value behind it fails rather than defaulting.
 */
function sentinelResolver(zip64Values: number[]) {
  let cursor = 0;
  return (value: number): number => {
    if (value !== U32_SENTINEL) return value;
    if (cursor >= zip64Values.length) verificationFailure();
    return zip64Values[cursor++]!;
  };
}

function inspectCentralDirectory(
  bytes: Uint8Array,
  expectedEntries: number,
): CentralEntry[] {
  const entries: CentralEntry[] = [];
  const names = new Set<string>();
  let offset = 0;
  let totalCompressed = 0;
  let totalUncompressed = 0;

  while (offset < bytes.length && entries.length < expectedEntries) {
    if (
      offset + ZIP_CENTRAL_HEADER_BYTES > bytes.length ||
      uint32(bytes, offset) !== 0x02014b50
    ) {
      verificationFailure();
    }

    const versionNeeded = uint16(bytes, offset + 6);
    const flags = uint16(bytes, offset + 8);
    const method = uint16(bytes, offset + 10);
    const crc32 = uint32(bytes, offset + 16);
    const rawCompressedSize = uint32(bytes, offset + 20);
    const rawUncompressedSize = uint32(bytes, offset + 24);
    const nameLength = uint16(bytes, offset + 28);
    const extraLength = uint16(bytes, offset + 30);
    const commentLength = uint16(bytes, offset + 32);
    const diskStart = uint16(bytes, offset + 34);
    const rawLocalOffset = uint32(bytes, offset + 42);
    const recordLength =
      ZIP_CENTRAL_HEADER_BYTES + nameLength + extraLength + commentLength;

    if (
      versionNeeded > ZIP_MAX_VERSION_NEEDED ||
      flags & ~ZIP_ALLOWED_FLAGS ||
      (method !== 0 && method !== 8) ||
      (method === 0 && flags & 0x0006) ||
      // ZIP64 can move this to the extra field, but a single-object archive
      // never needs to: real exporters leave it zero, so keep refusing the rest.
      diskStart !== 0 ||
      nameLength < 1 ||
      nameLength > MAX_ENTRY_NAME_BYTES ||
      offset + recordLength > bytes.length
    ) {
      verificationFailure("zip-central-header-invalid");
    }

    if (method === 8 && versionNeeded < 20) verificationFailure();

    const rawName = bytes.slice(
      offset + ZIP_CENTRAL_HEADER_BYTES,
      offset + ZIP_CENTRAL_HEADER_BYTES + nameLength,
    );
    if (!(flags & ZIP_UTF8_FLAG) && rawName.some((value) => value > 0x7f)) {
      verificationFailure();
    }
    const name = decodeUtf8(rawName);
    assertSafeArchivePath(name);

    const duplicateKey = name.toLowerCase();
    if (names.has(duplicateKey)) verificationFailure();
    names.add(duplicateKey);

    const extraStart = offset + ZIP_CENTRAL_HEADER_BYTES + nameLength;
    const resolve = sentinelResolver(
      parseExtraFields(bytes.subarray(extraStart, extraStart + extraLength)),
    );
    const uncompressedSize = resolve(rawUncompressedSize);
    const compressedSize = resolve(rawCompressedSize);
    const localOffset = resolve(rawLocalOffset);

    if (
      uncompressedSize > MAX_3MF_ENTRY_BYTES ||
      (compressedSize === 0 && uncompressedSize !== 0) ||
      (compressedSize > 0 &&
        uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO) ||
      (method === 0 && compressedSize !== uncompressedSize)
    ) {
      verificationFailure(
        `zip-entry-size-rejected name=${name} compressed=${compressedSize} uncompressed=${uncompressedSize}`,
      );
    }

    totalCompressed += compressedSize;
    totalUncompressed += uncompressedSize;
    if (
      !Number.isSafeInteger(totalCompressed) ||
      !Number.isSafeInteger(totalUncompressed) ||
      totalUncompressed > MAX_3MF_UNCOMPRESSED_BYTES ||
      (totalCompressed === 0 && totalUncompressed !== 0) ||
      (totalCompressed > 0 &&
        totalUncompressed / totalCompressed > MAX_COMPRESSION_RATIO)
    ) {
      verificationFailure(
        `zip-archive-size-rejected compressed=${totalCompressed} uncompressed=${totalUncompressed}`,
      );
    }

    entries.push({
      name,
      rawName,
      flags,
      method,
      crc32,
      compressedSize,
      uncompressedSize,
      localOffset,
    });
    offset += recordLength;
  }

  if (entries.length !== expectedEntries || offset !== bytes.length) {
    verificationFailure("zip-central-directory-length-mismatch");
  }
  return entries;
}

/**
 * Locates the end of a streamed entry's data descriptor.
 *
 * The descriptor's shape is not self-describing: the signature is optional and
 * the two size fields are 4 or 8 bytes depending on whether the entry is ZIP64.
 * Guessing would be unsound, so instead every permitted shape is tested against
 * the CRC and both sizes the central directory already gave us, and a shape is
 * accepted only when all three agree. A descriptor that contradicts the central
 * directory matches nothing and the entry is refused, so this stays a check
 * rather than a hole: the contiguity walk then requires the next local header to
 * begin exactly where the accepted shape ends.
 */
async function dataDescriptorEnd(
  reader: ArchiveReader,
  entry: CentralEntry,
  dataEnd: number,
  centralOffset: number,
): Promise<number> {
  const available = Math.min(ZIP_MAX_DATA_DESCRIPTOR_BYTES, centralOffset - dataEnd);
  if (available < 12) verificationFailure("zip-data-descriptor-truncated");
  const window = await reader.read(dataEnd, available);

  // Real writers emit the signature and the narrow form first, so ordering the
  // candidates this way makes the common case the first match.
  for (const signed of [true, false]) {
    for (const wide of [false, true]) {
      const base = signed ? 4 : 0;
      const length = base + 4 + (wide ? 16 : 8);
      if (length > available) continue;
      if (signed && uint32(window, 0) !== ZIP_DATA_DESCRIPTOR_SIGNATURE) continue;

      const crc32 = uint32(window, base);
      const compressedSize = wide
        ? uint64(window, base + 4)
        : uint32(window, base + 4);
      const uncompressedSize = wide
        ? uint64(window, base + 12)
        : uint32(window, base + 8);

      if (
        crc32 === entry.crc32 &&
        compressedSize === entry.compressedSize &&
        uncompressedSize === entry.uncompressedSize
      ) {
        return dataEnd + length;
      }
    }
  }

  verificationFailure("zip-data-descriptor-mismatch");
}

async function inspectLocalEntry(
  reader: ArchiveReader,
  entry: CentralEntry,
  centralOffset: number,
): Promise<ArchiveEntry> {
  if (entry.localOffset + ZIP_LOCAL_HEADER_BYTES > centralOffset) {
    verificationFailure();
  }

  const fixed = await reader.read(entry.localOffset, ZIP_LOCAL_HEADER_BYTES);
  if (uint32(fixed, 0) !== 0x04034b50) verificationFailure();

  const versionNeeded = uint16(fixed, 4);
  const flags = uint16(fixed, 6);
  const method = uint16(fixed, 8);
  const crc32 = uint32(fixed, 14);
  const rawCompressedSize = uint32(fixed, 18);
  const rawUncompressedSize = uint32(fixed, 22);
  const nameLength = uint16(fixed, 26);
  const extraLength = uint16(fixed, 28);

  const hasDataDescriptor = Boolean(flags & ZIP_DATA_DESCRIPTOR_FLAG);

  if (
    versionNeeded > ZIP_MAX_VERSION_NEEDED ||
    flags !== entry.flags ||
    method !== entry.method ||
    nameLength !== entry.rawName.length ||
    extraLength > MAX_LOCAL_EXTRA_BYTES ||
    // Without a descriptor the local CRC is authoritative and must agree. With
    // one, a streaming writer leaves it zero and the descriptor carries the
    // real value; a writer that fills it in anyway must still agree.
    (hasDataDescriptor ? crc32 !== 0 && crc32 !== entry.crc32 : crc32 !== entry.crc32)
  ) {
    verificationFailure("zip-local-header-mismatch");
  }

  const variableLength = nameLength + extraLength;
  const actualVariable = variableLength
    ? await reader.read(
        entry.localOffset + ZIP_LOCAL_HEADER_BYTES,
        variableLength,
      )
    : new Uint8Array();
  const localName = actualVariable.subarray(0, nameLength);
  if (!equalBytes(localName, entry.rawName)) verificationFailure("zip-local-name-mismatch");

  // The local header carries no offset field, so only the two sizes can be
  // sentinels here. They must still agree with the central directory.
  const resolve = sentinelResolver(
    parseExtraFields(actualVariable.subarray(nameLength)),
  );
  const uncompressedSize = resolve(rawUncompressedSize);
  const compressedSize = resolve(rawCompressedSize);
  const sizesZeroed = compressedSize === 0 && uncompressedSize === 0;
  if (
    (hasDataDescriptor ? !sizesZeroed : true) &&
    (compressedSize !== entry.compressedSize ||
      uncompressedSize !== entry.uncompressedSize)
  ) {
    verificationFailure("zip-local-size-mismatch");
  }

  const dataStart = entry.localOffset + ZIP_LOCAL_HEADER_BYTES + variableLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (
    !Number.isSafeInteger(dataEnd) ||
    dataEnd > centralOffset ||
    (entry.name.endsWith("/") &&
      (entry.compressedSize !== 0 ||
        entry.uncompressedSize !== 0 ||
        entry.crc32 !== 0))
  ) {
    verificationFailure("zip-local-data-range-invalid");
  }

  const recordEnd = hasDataDescriptor
    ? await dataDescriptorEnd(reader, entry, dataEnd, centralOffset)
    : dataEnd;

  return { ...entry, dataStart, dataEnd, recordEnd };
}

async function inspectLocalEntries(
  reader: ArchiveReader,
  centralEntries: CentralEntry[],
  centralOffset: number,
): Promise<ArchiveEntry[]> {
  const sorted = [...centralEntries].sort(
    (left, right) => left.localOffset - right.localOffset,
  );
  const entries: ArchiveEntry[] = [];

  for (const centralEntry of sorted) {
    entries.push(await inspectLocalEntry(reader, centralEntry, centralOffset));
  }

  let expectedOffset = 0;
  for (const entry of entries) {
    if (entry.localOffset !== expectedOffset) {
      verificationFailure(
        `zip-entry-not-contiguous at=${entry.localOffset} expected=${expectedOffset} name=${entry.name}`,
      );
    }
    expectedOffset = entry.recordEnd;
  }
  if (expectedOffset !== centralOffset) {
    verificationFailure(
      `zip-trailing-bytes-before-central end=${expectedOffset} central=${centralOffset}`,
    );
  }
  return entries;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < table.length; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[value] = crc >>> 0;
  }
  return table;
})();

function updateCrc32(crc: number, bytes: Uint8Array): number {
  let next = crc;
  for (const byte of bytes) {
    next = CRC32_TABLE[(next ^ byte) & 0xff]! ^ (next >>> 8);
  }
  return next >>> 0;
}

async function* decodedChunks(
  reader: ArchiveReader,
  entry: ArchiveEntry,
): AsyncGenerator<Uint8Array> {
  if (entry.method === 0) {
    yield* reader.chunks(entry.dataStart, entry.compressedSize);
    return;
  }

  const source = Readable.from(
    reader.chunks(entry.dataStart, entry.compressedSize),
  );
  const inflater = createInflateRaw({ chunkSize: 64 * 1024 });
  source.pipe(inflater);

  try {
    for await (const chunk of inflater) {
      if (!isByteView(chunk)) verificationFailure();
      yield chunk;
    }
  } catch (error) {
    if (error instanceof StorageVerificationError) throw error;
    // An unexpected throw (zlib, saxes, a range read) previously collapsed to
    // "unspecified", which is the one failure shape no report can act on.
    verificationFailure(
      `3mf-unexpected ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
    );
  } finally {
    source.destroy();
    inflater.destroy();
  }
}

type LexicalState = "text" | "tag" | "comment" | "pi" | "cdata";

class XmlLexicalGuard {
  private state: LexicalState = "text";
  private tokenLength = 0;
  private tagPrefix = "";
  private tagPending = false;
  private quote = "";
  private commentTail = "";
  private cdataTail = "";
  private piQuestion = false;

  write(text: string): void {
    for (const character of text) {
      this.tokenLength += 1;
      if (this.tokenLength > MAX_XML_TOKEN_CHARS) verificationFailure("xml-token-too-large");

      if (this.state === "text") {
        if (character === "<") {
          this.state = "tag";
          this.tokenLength = 1;
          this.tagPrefix = "<";
          this.tagPending = true;
          this.quote = "";
        }
        continue;
      }

      if (this.state === "comment") {
        this.commentTail = `${this.commentTail}${character}`.slice(-3);
        if (this.commentTail === "-->") this.enterText();
        continue;
      }

      if (this.state === "cdata") {
        this.cdataTail = `${this.cdataTail}${character}`.slice(-3);
        if (this.cdataTail === "]]>") this.enterText();
        continue;
      }

      if (this.state === "pi") {
        if (this.piQuestion && character === ">") {
          this.enterText();
        } else {
          this.piQuestion = character === "?";
        }
        continue;
      }

      if (this.tagPending) {
        this.tagPrefix += character;
        if (this.tagPrefix === "<?") {
          this.state = "pi";
          this.piQuestion = false;
          continue;
        }
        if ("<!--".startsWith(this.tagPrefix)) {
          if (this.tagPrefix === "<!--") {
            this.state = "comment";
            this.commentTail = "";
          }
          continue;
        }
        if ("<![CDATA[".startsWith(this.tagPrefix)) {
          if (this.tagPrefix === "<![CDATA[") {
            this.state = "cdata";
            this.cdataTail = "";
          }
          continue;
        }
        if (this.tagPrefix.startsWith("<!")) verificationFailure("xml-invalid-declaration");
        this.tagPending = false;
      }

      if (this.quote) {
        if (character === this.quote) this.quote = "";
      } else if (character === '"' || character === "'") {
        this.quote = character;
      } else if (character === ">") {
        this.enterText();
      }
    }
  }

  finish(): void {
    if (this.state !== "text") verificationFailure("xml-unterminated-state");
  }

  private enterText(): void {
    this.state = "text";
    this.tokenLength = 0;
    this.tagPrefix = "";
    this.tagPending = false;
    this.quote = "";
    this.commentTail = "";
    this.cdataTail = "";
    this.piQuestion = false;
  }
}

function attribute(tag: SaxesTagNS, name: string): string | undefined {
  return (Object.values(tag.attributes) as SaxesAttributeNS[]).find(
    (candidate) => candidate.local === name && candidate.uri === "",
  )?.value;
}

abstract class XmlInspector {
  private readonly decoder = new TextDecoder("utf-8", { fatal: true });
  private readonly lexicalGuard = new XmlLexicalGuard();
  private readonly parser = new SaxesParser({
    xmlns: true,
    fragment: false,
    position: false,
  });
  protected depth = 0;
  private elements = 0;

  constructor() {
    this.parser.on("xmldecl", (declaration) => {
      if (
        declaration.encoding &&
        !/^utf-?8$/i.test(declaration.encoding.trim())
      ) {
        verificationFailure();
      }
    });
    this.parser.on("doctype", () => verificationFailure());
    this.parser.on("opentag", (tag) => {
      this.depth += 1;
      this.elements += 1;
      if (
        this.depth > MAX_XML_DEPTH ||
        this.elements > MAX_XML_ELEMENTS ||
        Object.keys(tag.attributes).length > MAX_XML_ATTRIBUTES
      ) {
        verificationFailure();
      }
      this.openTag(tag);
    });
    this.parser.on("closetag", (tag) => {
      this.closeTag(tag);
      this.depth -= 1;
    });
  }

  write(bytes: Uint8Array): void {
    try {
      this.writeText(this.decoder.decode(bytes, { stream: true }));
    } catch (error) {
      if (error instanceof StorageVerificationError) throw error;
      verificationFailure();
    }
  }

  close(): void {
    try {
      this.writeText(this.decoder.decode());
      this.lexicalGuard.finish();
      this.parser.close();
      if (this.depth !== 0) verificationFailure();
    } catch (error) {
      if (error instanceof StorageVerificationError) throw error;
      verificationFailure();
    }
  }

  protected abstract openTag(tag: SaxesTagNS): void;

  protected closeTag(tag: SaxesTagNS): void {
    void tag;
  }

  private writeText(text: string): void {
    if (!text) return;
    this.lexicalGuard.write(text);
    this.parser.write(text);
  }
}

class ContentTypesInspector extends XmlInspector {
  private sawRoot = false;
  private permitsModel = false;

  constructor(private readonly modelNames: ReadonlySet<string>) {
    super();
  }

  protected openTag(tag: SaxesTagNS): void {
    if (this.depth === 1) {
      if (
        tag.local !== "Types" ||
        !namespaceAllows(tag.uri, CONTENT_TYPES_NAMESPACE) ||
        this.sawRoot
      ) {
        verificationFailure(
          `content-types-invalid-root local=${tag.local} uri=${tag.uri}`,
        );
      }
      this.sawRoot = true;
      return;
    }

    if (this.depth !== 2) return;
    const contentType = attribute(tag, "ContentType");
    if (contentType !== MODEL_3MF_CONTENT_TYPE) return;

    if (
      tag.local === "Default" &&
      attribute(tag, "Extension")?.toLowerCase() === "model"
    ) {
      this.permitsModel = true;
      return;
    }

    if (tag.local === "Override") {
      const partName = attribute(tag, "PartName");
      if (partName) {
        const cleanName = partName.startsWith("/") ? partName.slice(1) : partName;
        if (this.modelNames.has(cleanName) || /\.model$/i.test(cleanName)) {
          this.permitsModel = true;
        }
      }
    }
  }

  valid(): boolean {
    return this.sawRoot && this.permitsModel;
  }
}

class ModelInspector extends XmlInspector {
  private sawRoot = false;
  private resourcesDepth = -1;
  private buildDepth = -1;
  private sawObject = false;
  private sawItem = false;

  protected openTag(tag: SaxesTagNS): void {
    if (this.depth === 1) {
      if (
        tag.local.toLowerCase() !== "model" ||
        !namespaceAllows(tag.uri, CORE_3MF_NAMESPACE) ||
        this.sawRoot
      ) {
        verificationFailure(
          `3mf-invalid-model-root local=${tag.local} uri=${tag.uri}`,
        );
      }
      this.sawRoot = true;
      return;
    }

    if (tag.local === "resources" && (this.depth === 2 || this.resourcesDepth === -1)) {
      this.resourcesDepth = this.depth;
    } else if (tag.local === "build" && (this.depth === 2 || this.buildDepth === -1)) {
      this.buildDepth = this.depth;
    } else if (
      this.resourcesDepth !== -1 &&
      this.depth > this.resourcesDepth &&
      tag.local === "object"
    ) {
      this.sawObject = true;
    } else if (
      this.buildDepth !== -1 &&
      this.depth > this.buildDepth &&
      tag.local === "item"
    ) {
      this.sawItem = true;
    }
  }

  protected closeTag(tag: SaxesTagNS): void {
    if (this.depth === this.resourcesDepth && tag.local === "resources") {
      this.resourcesDepth = -1;
    }
    if (this.depth === this.buildDepth && tag.local === "build") {
      this.buildDepth = -1;
    }
  }

  valid(): boolean {
    return this.sawRoot && (this.sawObject || this.sawItem);
  }
}

async function verifyEntryPayloads(
  reader: ArchiveReader,
  entries: ArchiveEntry[],
): Promise<void> {
  const modelNames = new Set(
    entries
      .map((entry) => entry.name)
      .filter((name) => /(?:^|\/)3D\/.+\.model$/i.test(name) || /\.model$/i.test(name)),
  );
  if (!modelNames.size) verificationFailure("3mf-no-model-entries");

  let contentTypesInspector: ContentTypesInspector | undefined;
  let validModels = 0;
  let totalActualUncompressed = 0;
  let totalCompressed = 0;

  for (const entry of entries) {
    totalCompressed += entry.compressedSize;
    const isModel = modelNames.has(entry.name);
    const inspector =
      entry.name === "[Content_Types].xml"
        ? new ContentTypesInspector(modelNames)
        : isModel
          ? new ModelInspector()
          : undefined;

    let actualSize = 0;
    let crc = 0xffffffff;
    for await (const chunk of decodedChunks(reader, entry)) {
      actualSize += chunk.length;
      totalActualUncompressed += chunk.length;
      if (
        actualSize > entry.uncompressedSize ||
        actualSize > MAX_3MF_ENTRY_BYTES ||
        totalActualUncompressed > MAX_3MF_UNCOMPRESSED_BYTES ||
        (entry.compressedSize === 0 && actualSize > 0) ||
        (entry.compressedSize > 0 &&
          actualSize / entry.compressedSize > MAX_COMPRESSION_RATIO)
      ) {
        verificationFailure("3mf-decompression-limit-exceeded");
      }
      crc = updateCrc32(crc, chunk);
      inspector?.write(chunk);
    }

    if (
      actualSize !== entry.uncompressedSize ||
      (crc ^ 0xffffffff) >>> 0 !== entry.crc32
    ) {
      verificationFailure("3mf-crc-or-size-mismatch");
    }

    inspector?.close();
    if (inspector instanceof ContentTypesInspector) {
      contentTypesInspector = inspector;
    } else if (inspector instanceof ModelInspector && inspector.valid()) {
      validModels += 1;
    }
  }

  if (
    totalActualUncompressed > MAX_3MF_UNCOMPRESSED_BYTES ||
    (totalCompressed === 0 && totalActualUncompressed !== 0) ||
    (totalCompressed > 0 &&
      totalActualUncompressed / totalCompressed > MAX_COMPRESSION_RATIO) ||
    !contentTypesInspector?.valid() ||
    validModels < 1
  ) {
    verificationFailure("3mf-structure-invalid");
  }
}

async function assert3mf(key: string, size: number): Promise<void> {
  if (!Number.isSafeInteger(size) || size < ZIP_EOCD_BYTES) {
    verificationFailure();
  }
  const reader = new ArchiveReader(key, size);
  const head = await reader.read(0, 4);
  if (!startsWith(head, [0x50, 0x4b, 0x03, 0x04])) {
    verificationFailure("zip-missing-local-signature");
  }

  const tailLength = Math.min(size, ZIP_MAX_COMMENT_BYTES + ZIP_EOCD_BYTES);
  const tailStart = size - tailLength;
  const tail = await reader.read(tailStart, tailLength, false);
  const eocd = findEndOfCentralDirectory(tail);
  const disk = uint16(tail, eocd + 4);
  const centralDisk = uint16(tail, eocd + 6);
  const entriesOnDisk = uint16(tail, eocd + 8);
  const eocdOffset = tailStart + eocd;

  let totalEntries = uint16(tail, eocd + 10);
  let centralSize = uint32(tail, eocd + 12);
  let centralOffset = uint32(tail, eocd + 16);
  // Where the central directory must stop. ZIP64 slots its own record and
  // locator between the directory and the classic EOCD, so the contiguity
  // requirement moves back rather than being relaxed.
  let centralDirectoryEnd = eocdOffset;

  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== totalEntries ||
    centralSize < ZIP_CENTRAL_HEADER_BYTES
  ) {
    verificationFailure(
      `zip-eocd-invalid disk=${disk} centralDisk=${centralDisk} onDisk=${entriesOnDisk} total=${totalEntries} centralSize=${centralSize}`,
    );
  }

  const hasZip64Locator =
    eocdOffset >= ZIP64_EOCD_LOCATOR_BYTES &&
    eocd >= ZIP64_EOCD_LOCATOR_BYTES &&
    uint32(tail, eocd - ZIP64_EOCD_LOCATOR_BYTES) ===
      ZIP64_EOCD_LOCATOR_SIGNATURE;

  if (hasZip64Locator) {
    const locator = eocd - ZIP64_EOCD_LOCATOR_BYTES;
    const recordOffset = uint64(tail, locator + 8);
    if (
      uint32(tail, locator + 4) !== 0 ||
      uint32(tail, locator + 16) !== 1 ||
      recordOffset + ZIP64_EOCD_BYTES !== tailStart + locator
    ) {
      verificationFailure("zip64-locator-invalid");
    }

    const record = await reader.read(recordOffset, ZIP64_EOCD_BYTES, false);
    const recordEntries = uint64(record, 32);
    const recordCentralSize = uint64(record, 40);
    const recordCentralOffset = uint64(record, 48);
    if (
      uint32(record, 0) !== ZIP64_EOCD_SIGNATURE ||
      // An extensible data sector would push the locator away from the record.
      uint64(record, 4) !== ZIP64_EOCD_DECLARED_BYTES ||
      uint16(record, 14) > ZIP_MAX_VERSION_NEEDED ||
      uint32(record, 16) !== 0 ||
      uint32(record, 20) !== 0 ||
      uint64(record, 24) !== recordEntries ||
      // A field that is not a sentinel must still agree with the record.
      (totalEntries !== U16_SENTINEL && totalEntries !== recordEntries) ||
      (centralSize !== U32_SENTINEL && centralSize !== recordCentralSize) ||
      (centralOffset !== U32_SENTINEL && centralOffset !== recordCentralOffset)
    ) {
      verificationFailure("zip64-eocd-invalid");
    }

    totalEntries = recordEntries;
    centralSize = recordCentralSize;
    centralOffset = recordCentralOffset;
    centralDirectoryEnd = recordOffset;
  }

  if (
    totalEntries < 1 ||
    totalEntries > MAX_3MF_ENTRIES ||
    centralSize < ZIP_CENTRAL_HEADER_BYTES ||
    centralSize > MAX_CENTRAL_DIRECTORY_BYTES ||
    centralOffset + centralSize !== centralDirectoryEnd ||
    centralOffset < ZIP_LOCAL_HEADER_BYTES
  ) {
    verificationFailure(
      `zip-central-directory-bounds entries=${totalEntries} size=${centralSize} offset=${centralOffset} end=${centralDirectoryEnd}`,
    );
  }

  const central = await reader.read(centralOffset, centralSize, false);
  const centralEntries = inspectCentralDirectory(central, totalEntries);
  const entries = await inspectLocalEntries(reader, centralEntries, centralOffset);
  await verifyEntryPayloads(reader, entries);
}

export async function assertSafeModelStructure(
  key: string,
  format: UploadFormat,
  size: number,
): Promise<void> {
  if (format === "stl") return assertStl(key, size);

  try {
    await assert3mf(key, size);
  } catch (error) {
    if (error instanceof StorageVerificationError) throw error;
    // An unexpected throw (zlib, saxes, a range read) previously collapsed to
    // "unspecified", which is the one failure shape no report can act on.
    verificationFailure(
      `3mf-unexpected ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
    );
  }
}
