import { compareVersions, isTrustedUpdateUrl, resolveUpdateUrl } from "@/lib/appUpdate";

describe("appUpdate", () => {
  it("only trusts https download links on the release hosts", () => {
    expect(isTrustedUpdateUrl("https://expo.dev/artifacts/eas/abc.apk")).toBe(true);
    expect(isTrustedUpdateUrl("https://github.com/owner/repo/releases/download/v1/app.apk")).toBe(true);
    expect(isTrustedUpdateUrl("https://objects.githubusercontent.com/x/app.apk")).toBe(true);
    expect(isTrustedUpdateUrl("http://expo.dev/artifacts/eas/abc.apk")).toBe(false);
    expect(isTrustedUpdateUrl("https://evil.example/app.apk")).toBe(false);
    expect(isTrustedUpdateUrl("https://expo.dev.evil.example/app.apk")).toBe(false);
    expect(isTrustedUpdateUrl("not a url")).toBe(false);
  });

  it("ignores an untrusted APK link from the manifest", () => {
    const url = resolveUpdateUrl({
      latestVersion: "9.0.2",
      minimumVersion: "9.0.1",
      apkUrl: "https://evil.example/attendx.apk",
    });

    expect(url).not.toBe("https://evil.example/attendx.apk");
  });

  it("compares versions numerically", () => {
    expect(compareVersions("9.0.1", "9.0.10")).toBe(-1);
    expect(compareVersions("9.1.0", "9.0.9")).toBe(1);
    expect(compareVersions("9.0.1", "9.0.1")).toBe(0);
  });
});
