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

function makeZip(inputs: ZipInput[]): TestZip {
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
    const version = method === 8 ? 20 : 10;
    const flags = 0x0800;

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(version, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(payload.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    locals.push(local, compressed);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(version, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(payload.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centralParts.push(central);

    records.push({
      localOffset,
      centralOffset: 0,
      compressedSize: compressed.length,
      uncompressedSize: payload.length,
    });
    localOffset += local.length + compressed.length;
  }

  const centralOffset = localOffset;
  let centralCursor = centralOffset;
  centralParts.forEach((part, index) => {
    records[index]!.centralOffset = centralCursor;
    centralCursor += part.length;
  });
  const centralSize = centralCursor - centralOffset;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(inputs.length, 8);
  eocd.writeUInt16LE(inputs.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);

  return {
    bytes: Buffer.concat([...locals, ...centralParts, eocd]),
    centralOffset,
    records,
  };
}

function minimal3mf(extra: ZipInput[] = []): TestZip {
  return makeZip([
    { name: "[Content_Types].xml", data: CONTENT_TYPES },
    { name: "3D/3dmodel.model", data: MODEL },
    ...extra,
  ]);
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

  it("rejects data descriptors, encryption, and ZIP64 metadata", async () => {
    const descriptor = minimal3mf();
    descriptor.bytes.writeUInt16LE(0x0808, descriptor.records[0]!.localOffset + 6);
    descriptor.bytes.writeUInt16LE(0x0808, descriptor.records[0]!.centralOffset + 8);
    await expect3mfRejected(descriptor);

    const encrypted = minimal3mf();
    encrypted.bytes.writeUInt16LE(0x0801, encrypted.records[0]!.localOffset + 6);
    encrypted.bytes.writeUInt16LE(0x0801, encrypted.records[0]!.centralOffset + 8);
    await expect3mfRejected(encrypted);

    const zip64 = minimal3mf();
    zip64.bytes.writeUInt32LE(0xffffffff, zip64.records[0]!.centralOffset + 24);
    await expect3mfRejected(zip64);
  });
});
