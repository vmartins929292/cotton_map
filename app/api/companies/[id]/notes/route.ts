import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { listNotes } from "@/lib/notes";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  try {
    const notes = await listNotes(id);
    return NextResponse.json({ notes });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro interno" },
      { status: 500 }
    );
  }
}
