import { createClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: "Code required" }, { status: 400 });
    }

    // Load session
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("winner_id, status")
      .eq("code", code.toUpperCase())
      .single();

    if (sessionError || !session) {
      console.error("Error loading session:", sessionError);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Type assertion for selected fields
    const sessionData = session as { winner_id: string | null; status: string };

    // Check if session has ended (both games complete)
    if (sessionData.status !== "ended") {
      console.error("Session not ended yet:", sessionData.status);
      return NextResponse.json(
        { error: "Game not complete yet" },
        { status: 400 }
      );
    }

    // Check if winner_id is set
    if (!sessionData.winner_id) {
      console.error("No winner_id set in session");
      return NextResponse.json(
        { error: "Winner not determined yet" },
        { status: 400 }
      );
    }

    // Check if user is the winner - compare as strings to avoid type issues
    const sessionWinnerId = sessionData.winner_id?.toString() || null;
    const userIdString = user.id?.toString() || null;

    console.log("Checking winner:", {
      sessionWinnerId,
      userId: userIdString,
      match: sessionWinnerId === userIdString,
      types: {
        sessionType: typeof sessionWinnerId,
        userType: typeof userIdString,
      },
    });

    if (!sessionWinnerId || sessionWinnerId !== userIdString) {
      console.error("User is not the winner", {
        sessionWinnerId,
        userId: userIdString,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Return the gender reveal (hardcoded as specified)
    return NextResponse.json({
      revealText: "It's a Boy!!!!!!!!",
    });
  } catch (error: any) {
    console.error("Error in reveal API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
