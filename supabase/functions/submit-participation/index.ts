import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParticipationRequest {
  opportunityId: string;
  organizationId: string;
  amount: number;
  notes?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { opportunityId, organizationId, amount, notes }: ParticipationRequest = await req.json();

    const { data: opportunity, error: oppError } = await supabase
      .from("opportunities")
      .select("*")
      .eq("id", opportunityId)
      .single();

    if (oppError || !opportunity) {
      throw new Error("Opportunity not found");
    }

    if (opportunity.status !== "active") {
      throw new Error("Opportunity is not active");
    }

    const { data: participation, error: participationError } = await supabase
      .from("participation")
      .insert({
        opportunity_id: opportunityId,
        organization_id: organizationId,
        amount,
        status: "pending",
        notes,
      })
      .select()
      .single();

    if (participationError) {
      throw participationError;
    }

    await supabase.from("notifications").insert({
      user_id: user.id,
      title: "Participation Submitted",
      message: `Your participation in ${opportunity.name} has been submitted successfully.`,
      type: "success",
    });

    return new Response(
      JSON.stringify({
        success: true,
        participation,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
