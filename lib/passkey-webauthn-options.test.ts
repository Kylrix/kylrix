import { describe, it, expect } from "vitest";
import { resolvePasskeyRpId, transportsForPasskeyEntry } from "./passkey-webauthn-options";

describe("passkey-webauthn-options", () => {
  describe("resolvePasskeyRpId", () => {
    it("returns localhost as-is", () => {
      expect(resolvePasskeyRpId("localhost")).toBe("localhost");
    });

    it("returns 127.0.0.1 as-is", () => {
      expect(resolvePasskeyRpId("127.0.0.1")).toBe("127.0.0.1");
    });

    it("returns kylrix.space for exact match", () => {
      expect(resolvePasskeyRpId("kylrix.space")).toBe("kylrix.space");
    });

    it("returns kylrix.space for subdomains of kylrix.space", () => {
      expect(resolvePasskeyRpId("app.kylrix.space")).toBe("kylrix.space");
      expect(resolvePasskeyRpId("staging.sub.kylrix.space")).toBe("kylrix.space");
    });

    it("returns hostname unchanged for custom or unrecognised hostnames", () => {
      expect(resolvePasskeyRpId("example.com")).toBe("example.com");
      expect(resolvePasskeyRpId("notkylrix.space")).toBe("notkylrix.space");
      expect(resolvePasskeyRpId("fakekylrix.space")).toBe("fakekylrix.space");
    });
  });

  describe("transportsForPasskeyEntry", () => {
    it("returns ['internal'] if entry has missing, null, or empty params", () => {
      expect(transportsForPasskeyEntry({})).toEqual(["internal"]);
      expect(transportsForPasskeyEntry({ params: null })).toEqual(["internal"]);
      expect(transportsForPasskeyEntry({ params: undefined })).toEqual(["internal"]);
      expect(transportsForPasskeyEntry({ params: "" })).toEqual(["internal"]);
    });

    it("returns ['internal'] if params is invalid JSON (caught in try-catch)", () => {
      expect(transportsForPasskeyEntry({ params: "{invalid-json" })).toEqual(["internal"]);
      expect(transportsForPasskeyEntry({ params: "undefined" })).toEqual(["internal"]);
    });

    it("returns ['internal'] if JSON parses to a primitive non-object value", () => {
      expect(transportsForPasskeyEntry({ params: JSON.stringify(null) })).toEqual(["internal"]);
      expect(transportsForPasskeyEntry({ params: JSON.stringify(123) })).toEqual(["internal"]);
      expect(transportsForPasskeyEntry({ params: JSON.stringify(true) })).toEqual(["internal"]);
      expect(transportsForPasskeyEntry({ params: JSON.stringify("string-payload") })).toEqual(["internal"]);
    });

    it("returns ['internal'] if transports property is missing or not an array", () => {
      expect(transportsForPasskeyEntry({ params: JSON.stringify({}) })).toEqual(["internal"]);
      expect(transportsForPasskeyEntry({ params: JSON.stringify({ transports: "usb" }) })).toEqual(["internal"]);
      expect(transportsForPasskeyEntry({ params: JSON.stringify({ transports: null }) })).toEqual(["internal"]);
      expect(transportsForPasskeyEntry({ params: JSON.stringify({ transports: 42 }) })).toEqual(["internal"]);
    });

    it("returns ['internal'] fallback if transports array is empty", () => {
      expect(transportsForPasskeyEntry({ params: JSON.stringify({ transports: [] }) })).toEqual(["internal"]);
    });

    it("filters out invalid/unknown transport values and returns valid ones", () => {
      const params = JSON.stringify({
        transports: ["usb", "invalid_transport", "internal", 123, null, {}, ["ble"]],
      });
      expect(transportsForPasskeyEntry({ params })).toEqual(["usb", "internal"]);
    });

    it("returns ['internal'] fallback if array contains no valid known transports", () => {
      const params = JSON.stringify({
        transports: ["unknown_1", "unknown_2", 999, false],
      });
      expect(transportsForPasskeyEntry({ params })).toEqual(["internal"]);
    });

    it("preserves all known transport types when provided", () => {
      const known = ["internal", "usb", "nfc", "ble", "hybrid"];
      const params = JSON.stringify({ transports: known });
      expect(transportsForPasskeyEntry({ params })).toEqual(known);
    });

    it("deduplicates or maintains valid transports from mixed input list", () => {
      const params = JSON.stringify({
        transports: ["nfc", "ble"],
      });
      expect(transportsForPasskeyEntry({ params })).toEqual(["nfc", "ble"]);
    });
  });
});
