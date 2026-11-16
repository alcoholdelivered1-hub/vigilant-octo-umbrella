import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.id) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const tokens = await base44.asServiceRole.entities.FCMToken.filter({ user_id: user.id });
    await Promise.all((tokens || []).map((token) =>
      base44.asServiceRole.entities.FCMToken.delete(token.id)
    ));

    await base44.asServiceRole.entities.User.delete(user.id);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Account deletion failed", error);
    return Response.json(
      { error: "Unable to delete account. Please try again or contact support." },
      { status: 500 },
    );
  }
});
