import { deflateRawSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";

const objectState = vi.hoisted(
  (): { bytes: Uint8Array<ArrayBufferLike> } => ({ bytes: new Uint8Array() }),
);

vi.mock("@/app/lib/storage/r2", () => {
  class StorageVerificationError extends Error {}
  return {
    StorageVerificationError,
    readObjectRange: vi.fn(async (_key: string, start: number, end: number) =>
      objectState.bytes.slice(start, end + 1),
    ),
  };
});

import { assertSafeModelStructure } from "@/app/lib/storage/file-structure";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

const MODEL = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/>
          <vertex x="1" y="0" z="0"/>
          <vertex x="0" y="1" z="0"/>
        </vertices>
        <triangles><triangle v1="0" v2="1" v3="2"/></triangles>
      </mesh>
    </object>
  </resources>
  <build><item objectid="1"/></build>
</model>`;

type ZipInput = {
  name: string;
  data: string | Uint8Array;
  method?: 0 | 8;
};

/**
 * Real exporters (Fusion 360, Bambu Studio, PrusaSlicer, Orca) write ZIP64
 * records into every 3MF regardless of size, so the sentinel form below is
 * the common case rather than an exotic one.
 */
type ZipOptions = {
  zip64?: boolean;
  /**
   * Slicers that stream their export (Bambu Studio, OrcaSlicer) set general
   * purpose bit 3, zero the CRC and both sizes in the local header, and repeat
   * them in a data descriptor after the compressed bytes. The signature on that
   * descriptor is optional in the spec and both forms appear in the wild.
   */
  descriptor?: "none" | "signed" | "unsigned";
};

type ZipRecord = {
  localOffset: number;
  centralOffset: number;
  compressedSize: number;
  uncompressedSize: number;
};

type TestZip = {
  bytes: Buffer;
  centralOffset: number;
  records: ZipRecord[];
};

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

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function bytes(input: string | Uint8Array): Buffer {
  return typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input);
}

function makeZip(inputs: ZipInput[], options: ZipOptions = {}): TestZip {
  const zip64 = options.zip64 ?? false;
  const descriptor = options.descriptor ?? "none";
  const streamed = descriptor !== "none";
  const locals: Buffer[] = [];
  const centralParts: Buffer[] = [];
  const records: ZipRecord[] = [];
  let localOffset = 0;

  for (const input of inputs) {
    const name = Buffer.from(input.name, "utf8");
    const payload = bytes(input.data);
    const method = input.method ?? 8;
    const compressed = method === 8 ? deflateRawSync(payload) : payload;
    const crc = crc32(payload);
    const version = zip64 ? 45 : method === 8 ? 20 : 10;
    const flags = streamed ? 0x0808 : 0x0800;

    // ZIP64 replaces each oversized field with a 0xffffffff sentinel and
    // carries the real value in the 0x0001 extra field, in spec order.
    const localExtra = zip64 ? Buffer.alloc(20) : Buffer.alloc(0);
    if (zip64) {
      localExtra.writeUInt16LE(0x0001, 0);
      localExtra.writeUInt16LE(16, 2);
      localExtra.writeBigUInt64LE(BigInt(streamed ? 0 : payload.length), 4);
      localExtra.writeBigUInt64LE(BigInt(streamed ? 0 : compressed.length), 12);
    }

    const local = Buffer.alloc(30 + name.length + localExtra.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(version, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(streamed ? 0 : crc, 14);
    local.writeUInt32LE(streamed ? (zip64 ? 0xffffffff : 0) : zip64 ? 0xffffffff : compressed.length, 18);
    local.writeUInt32LE(streamed ? (zip64 ? 0xffffffff : 0) : zip64 ? 0xffffffff : payload.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(localExtra.length, 28);
    name.copy(local, 30);
    localExtra.copy(local, 30 + name.length);
    const trailer = streamed
      ? (() => {
          const signatureBytes = descriptor === "signed" ? 4 : 0;
          const buffer = Buffer.alloc(signatureBytes + 4 + (zip64 ? 16 : 8));
          if (signatureBytes) buffer.writeUInt32LE(0x08074b50, 0);
          buffer.writeUInt32LE(crc, signatureBytes);
          if (zip64) {
            buffer.writeBigUInt64LE(BigInt(compressed.length), signatureBytes + 4);
            buffer.writeBigUInt64LE(BigInt(payload.length), signatureBytes + 12);
          } else {
            buffer.writeUInt32LE(compressed.length, signatureBytes + 4);
            buffer.writeUInt32LE(payload.length, signatureBytes + 8);
          }
          return buffer;
        })()
      : Buffer.alloc(0);
    locals.push(local, compressed, trailer);

    const centralExtra = zip64 ? Buffer.alloc(28) : Buffer.alloc(0);
    if (zip64) {
      centralExtra.writeUInt16LE(0x0001, 0);
      centralExtra.writeUInt16LE(24, 2);
      centralExtra.writeBigUInt64LE(BigInt(payload.length), 4);
      centralExtra.writeBigUInt64LE(BigInt(compressed.length), 12);
      centralExtra.writeBigUInt64LE(BigInt(localOffset), 20);
    }

    const central = Buffer.alloc(46 + name.length + centralExtra.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(version, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(zip64 ? 0xffffffff : compressed.length, 20);
    central.writeUInt32LE(zip64 ? 0xffffffff : payload.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(centralExtra.length, 30);
    central.writeUInt32LE(zip64 ? 0xffffffff : localOffset, 42);
    name.copy(central, 46);
    centralExtra.copy(central, 46 + name.length);
    centralParts.push(central);

    records.push({
      localOffset,
      centralOffset: 0,
      compressedSize: compressed.length,
      uncompressedSize: payload.length,
    });
    localOffset += local.length + compressed.length + trailer.length;
  }

  const centralOffset = localOffset;
  let centralCursor = centralOffset;
  centralParts.forEach((part, index) => {
    records[index]!.centralOffset = centralCursor;
    centralCursor += part.length;
  });
  const centralSize = centralCursor - centralOffset;

  const zip64Parts: Buffer[] = [];
  if (zip64) {
    const record = Buffer.alloc(56);
    record.writeUInt32LE(0x06064b50, 0);
    record.writeBigUInt64LE(BigInt(44), 4);
    record.writeUInt16LE(45, 12);
    record.writeUInt16LE(45, 14);
    record.writeBigUInt64LE(BigInt(inputs.length), 24);
    record.writeBigUInt64LE(BigInt(inputs.length), 32);
    record.writeBigUInt64LE(BigInt(centralSize), 40);
    record.writeBigUInt64LE(BigInt(centralOffset), 48);

    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(0x07064b50, 0);
    locator.writeBigUInt64LE(BigInt(centralCursor), 8);
    locator.writeUInt32LE(1, 16);
    zip64Parts.push(record, locator);
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(zip64 ? 0xffff : inputs.length, 8);
  eocd.writeUInt16LE(zip64 ? 0xffff : inputs.length, 10);
  eocd.writeUInt32LE(zip64 ? 0xffffffff : centralSize, 12);
  eocd.writeUInt32LE(zip64 ? 0xffffffff : centralOffset, 16);

  return {
    bytes: Buffer.concat([...locals, ...centralParts, ...zip64Parts, eocd]),
    centralOffset,
    records,
  };
}

function minimal3mf(extra: ZipInput[] = [], options: ZipOptions = {}): TestZip {
  return makeZip(
    [
      { name: "[Content_Types].xml", data: CONTENT_TYPES },
      { name: "3D/3dmodel.model", data: MODEL },
      ...extra,
    ],
    options,
  );
}

function binaryStl(
  triangles: number,
  declaredTriangles = triangles,
): Uint8Array<ArrayBufferLike> {
  const result = new Uint8Array(84 + triangles * 50);
  new DataView(result.buffer).setUint32(80, declaredTriangles, true);
  return result;
}

async function expect3mfRejected(zip: TestZip | Buffer): Promise<void> {
  objectState.bytes = "bytes" in zip ? zip.bytes : zip;
  await expect(
    assertSafeModelStructure(
      "uploads/temp/test.3mf",
      "3mf",
      objectState.bytes.length,
    ),
  ).rejects.toThrow();
}

describe("model structure validation", () => {
  beforeEach(() => {
    objectState.bytes = new Uint8Array();
  });

  it("accepts a binary STL whose triangle count matches its byte length", async () => {
    objectState.bytes = binaryStl(2);
    await expect(
      assertSafeModelStructure(
        "uploads/temp/test.stl",
        "stl",
        objectState.bytes.length,
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects an STL with a false binary triangle count", async () => {
    objectState.bytes = binaryStl(1, 99);
    await expect(
      assertSafeModelStructure(
        "uploads/temp/test.stl",
        "stl",
        objectState.bytes.length,
      ),
    ).rejects.toThrow();
  });

  it("accepts a genuinely valid minimal 3MF", async () => {
    objectState.bytes = minimal3mf().bytes;
    await expect(
      assertSafeModelStructure(
        "uploads/temp/test.3mf",
        "3mf",
        objectState.bytes.length,
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects a 3MF that is not a ZIP archive", async () => {
    objectState.bytes = new TextEncoder().encode("not a zip-based 3mf model");
    await expect(
      assertSafeModelStructure(
        "uploads/temp/test.3mf",
        "3mf",
        objectState.bytes.length,
      ),
    ).rejects.toThrow();
  });

  it("rejects a fabricated central-directory-only ZIP", async () => {
    const zip = minimal3mf();
    const centralOnly = Buffer.from(zip.bytes.subarray(zip.centralOffset));
    centralOnly.writeUInt32LE(0, centralOnly.length - 22 + 16);
    await expect3mfRejected(centralOnly);
  });

  it("rejects falsified declared sizes after bounded actual inflation", async () => {
    const zip = minimal3mf();
    const model = zip.records[1]!;
    zip.bytes.writeUInt32LE(1, model.localOffset + 22);
    zip.bytes.writeUInt32LE(1, model.centralOffset + 24);
    await expect3mfRejected(zip);
  });

  it("rejects a high-ratio compression bomb before full inflation", async () => {
    const zip = minimal3mf([
      { name: "Metadata/bomb.bin", data: "A".repeat(2 * 1024 * 1024) },
    ]);
    await expect3mfRejected(zip);
  });

  it("rejects duplicate archive paths case-insensitively", async () => {
    const zip = minimal3mf([
      { name: "Metadata/readme.txt", data: "first" },
      { name: "metadata/README.txt", data: "second" },
    ]);
    await expect3mfRejected(zip);
  });

  it("rejects local payload ranges that overlap the next record", async () => {
    const zip = makeZip([
      { name: "[Content_Types].xml", data: CONTENT_TYPES, method: 0 },
      { name: "3D/3dmodel.model", data: MODEL },
    ]);
    const first = zip.records[0]!;
    const overlappingSize = first.compressedSize + 1;
    zip.bytes.writeUInt32LE(overlappingSize, first.localOffset + 18);
    zip.bytes.writeUInt32LE(overlappingSize, first.localOffset + 22);
    zip.bytes.writeUInt32LE(overlappingSize, first.centralOffset + 20);
    zip.bytes.writeUInt32LE(overlappingSize, first.centralOffset + 24);
    await expect3mfRejected(zip);
  });

  it("rejects path traversal entries", async () => {
    const zip = minimal3mf([
      { name: "3D/../escape.model", data: MODEL },
    ]);
    await expect3mfRejected(zip);
  });

  it("rejects payloads whose actual CRC does not match both headers", async () => {
    const zip = minimal3mf();
    const model = zip.records[1]!;
    const forgedCrc = zip.bytes.readUInt32LE(model.localOffset + 14) ^ 1;
    zip.bytes.writeUInt32LE(forgedCrc >>> 0, model.localOffset + 14);
    zip.bytes.writeUInt32LE(forgedCrc >>> 0, model.centralOffset + 16);
    await expect3mfRejected(zip);
  });

  it("rejects DTD and entity declarations in required XML", async () => {
    const maliciousModel = `<?xml version="1.0"?>
      <!DOCTYPE model [<!ENTITY payload "expanded">]>
      <model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
        <resources><object id="1"/></resources><build><item objectid="1"/></build>
      </model>`;
    const zip = makeZip([
      { name: "[Content_Types].xml", data: CONTENT_TYPES },
      { name: "3D/3dmodel.model", data: maliciousModel },
    ]);
    await expect3mfRejected(zip);
  });

  it("rejects XML that only mentions model tags inside comments", async () => {
    const fakeModel = `<not-model><!--
      <model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
        <resources><object id="1"/></resources><build><item objectid="1"/></build>
      </model>
    --></not-model>`;
    const zip = makeZip([
      { name: "[Content_Types].xml", data: CONTENT_TYPES },
      { name: "3D/3dmodel.model", data: fakeModel },
    ]);
    await expect3mfRejected(zip);
  });

  it("rejects encryption", async () => {
    const encrypted = minimal3mf();
    encrypted.bytes.writeUInt16LE(0x0801, encrypted.records[0]!.localOffset + 6);
    encrypted.bytes.writeUInt16LE(0x0801, encrypted.records[0]!.centralOffset + 8);
    await expect3mfRejected(encrypted);
  });

  // Bambu Studio and OrcaSlicer stream their project exports, so the multicolour
  // 3MFs that matter most here arrive in this shape. Rejecting it was what made
  // every such upload fail verification after a successful transfer.
  it.each([
    ["signed descriptor", { descriptor: "signed" } as ZipOptions],
    ["unsigned descriptor", { descriptor: "unsigned" } as ZipOptions],
    ["ZIP64 + signed descriptor", { zip64: true, descriptor: "signed" } as ZipOptions],
    ["ZIP64 + unsigned descriptor", { zip64: true, descriptor: "unsigned" } as ZipOptions],
  ])("accepts a streamed 3MF written with a %s", async (_label, options) => {
    objectState.bytes = minimal3mf([], options).bytes;
    await expect(
      assertSafeModelStructure(
        "uploads/temp/test.3mf",
        "3mf",
        objectState.bytes.length,
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects a descriptor flag set on an archive that carries no descriptor", async () => {
    const lying = minimal3mf();
    lying.bytes.writeUInt16LE(0x0808, lying.records[0]!.localOffset + 6);
    lying.bytes.writeUInt16LE(0x0808, lying.records[0]!.centralOffset + 8);
    await expect3mfRejected(lying);
  });

  it("rejects a descriptor whose CRC contradicts the central directory", async () => {
    const zip = minimal3mf([], { descriptor: "signed" });
    // Descriptor sits immediately after the first entry's compressed bytes:
    // local header + name + compressed data, then signature, then the CRC.
    const first = zip.records[0]!;
    const nameLength = zip.bytes.readUInt16LE(first.localOffset + 26);
    const extraLength = zip.bytes.readUInt16LE(first.localOffset + 28);
    const crcOffset =
      first.localOffset + 30 + nameLength + extraLength + first.compressedSize + 4;
    zip.bytes.writeUInt32LE((zip.bytes.readUInt32LE(crcOffset) ^ 0xff) >>> 0, crcOffset);
    await expect3mfRejected(zip);
  });

  it("accepts a ZIP64 3MF, the shape real exporters emit at any size", async () => {
    objectState.bytes = minimal3mf([], { zip64: true }).bytes;
    await expect(
      assertSafeModelStructure(
        "uploads/temp/test.3mf",
        "3mf",
        objectState.bytes.length,
      ),
    ).resolves.toBeUndefined();
  });

  it("accepts a ZIP64 3MF carrying the parts a slicer adds", async () => {
    objectState.bytes = minimal3mf(
      [
        { name: "_rels/.rels", data: "<Relationships/>" },
        { name: "Metadata/thumbnail.png", data: "thumbnail-bytes" },
      ],
      { zip64: true },
    ).bytes;
    await expect(
      assertSafeModelStructure(
        "uploads/temp/test.3mf",
        "3mf",
        objectState.bytes.length,
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects a ZIP64 sentinel with no extra field to resolve it", async () => {
    const zip = minimal3mf();
    zip.bytes.writeUInt32LE(0xffffffff, zip.records[0]!.centralOffset + 24);
    await expect3mfRejected(zip);
  });

  it("rejects a ZIP64 extra whose sizes contradict the local header", async () => {
    const zip = minimal3mf([], { zip64: true });
    const record = zip.records[0]!;
    // The central extra claims a different compressed size than the local one.
    const nameLength = zip.bytes.readUInt16LE(record.centralOffset + 28);
    const extraStart = record.centralOffset + 46 + nameLength;
    zip.bytes.writeBigUInt64LE(
      BigInt(record.compressedSize + 1),
      extraStart + 12,
    );
    await expect3mfRejected(zip);
  });

  it("accepts 3MF archives containing CDATA blocks and slicer project configs", async () => {
    const configData = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <notes><![CDATA[Print settings for 0.20mm Standard]]></notes>
</config>`;
    objectState.bytes = minimal3mf(
      [
        { name: "Metadata/slice_info.config", data: configData },
        { name: "Metadata/plate_1.png", data: "fake-png-data" },
      ],
      { zip64: true },
    ).bytes;
    await expect(
      assertSafeModelStructure(
        "uploads/temp/test.3mf",
        "3mf",
        objectState.bytes.length,
      ),
    ).resolves.toBeUndefined();
  });

  it("accepts 3MF models with 0-indexed object IDs and sub-models", async () => {
    const multiModel = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="0" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/>
          <vertex x="10" y="0" z="0"/>
          <vertex x="0" y="10" z="0"/>
        </vertices>
        <triangles><triangle v1="0" v2="1" v3="2"/></triangles>
      </mesh>
    </object>
  </resources>
  <build><item objectid="0"/></build>
</model>`;
    const subModel = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/>
          <vertex x="5" y="0" z="0"/>
          <vertex x="0" y="5" z="0"/>
        </vertices>
        <triangles><triangle v1="0" v2="1" v3="2"/></triangles>
      </mesh>
    </object>
  </resources>
</model>`;
    objectState.bytes = makeZip([
      { name: "[Content_Types].xml", data: CONTENT_TYPES },
      { name: "3D/3dmodel.model", data: multiModel },
      { name: "3D/Objects/part_1.model", data: subModel },
    ]).bytes;
    await expect(
      assertSafeModelStructure(
        "uploads/temp/test.3mf",
        "3mf",
        objectState.bytes.length,
      ),
    ).resolves.toBeUndefined();
  });
});
