import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MatchRequest {
  organizationId: string;
  criteria?: {
    minAmount?: number;
    maxAmount?: number;
    sector?: string;
    stage?: string;
  };
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

    const { organizationId, criteria = {} }: MatchRequest = await req.json();

    let query = supabase
      .from("opportunities")
      .select("*")
      .eq("status", "active");

    if (criteria.minAmount) {
      query = query.gte("amount", criteria.minAmount);
    }

    if (criteria.maxAmount) {
      query = query.lte("amount", criteria.maxAmount);
    }

    if (criteria.sector) {
      query = query.eq("sector", criteria.sector);
    }

    if (criteria.stage) {
      query = query.eq("stage", criteria.stage);
    }

    const { data: opportunities, error } = await query;

    if (error) {
      throw error;
    }

    const { data: existingParticipation } = await supabase
      .from("participation")
      .select("opportunity_id")
      .eq("organization_id", organizationId);

    const participatedOpportunityIds = new Set(
      existingParticipation?.map((p) => p.opportunity_id) || []
    );

    const matchedOpportunities = opportunities?.filter(
      (opp) => !participatedOpportunityIds.has(opp.id)
    ) || [];

    return new Response(
      JSON.stringify({
        matches: matchedOpportunities,
        count: matchedOpportunities.length,
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
