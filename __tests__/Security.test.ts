import { encrypt } from "../component/Core/Security";

describe("Security", () => {
  test("Encrypt and decrypt message", async () => {
    const text = "test";
    const cypher = await encrypt(text);
    expect(cypher).toBeTruthy();
  });
});
