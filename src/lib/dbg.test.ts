import { describe, it, vi, expect } from "vitest";
vi.mock("@/lib/api-auth.server", () => ({ getRequestUserId: async () => "u" }));
describe("dbg", () => { it("x", async () => {
  process.env["LOVABLE_API_KEY"]="k";
  vi.stubGlobal("fetch", vi.fn(async()=>new Response(JSON.stringify({text:"ok"}),{status:200})));
  const { Route } = await import("@/routes/api/transcribe");
  const h=(Route.options as any).server.handlers.POST;
  const form=new FormData();
  form.append("file", new File([new Uint8Array([1,2,3])],"voice.webm",{type:"audio/webm"}));
  const res=await h({request:new Request("http://localhost/api/transcribe",{method:"POST",body:form})});
  console.log(res.status, await res.text());
  expect(1).toBe(1);
});});
