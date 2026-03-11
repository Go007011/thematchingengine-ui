import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const url = new URL(req.url);
    const organizationId = url.searchParams.get("organizationId");

    const { data: opportunities, error: oppError } = await supabase
      .from("opportunities")
      .select("*");

    if (oppError) throw oppError;

    const { data: participation, error: partError } = await supabase
      .from("participation")
      .select("*");

    if (partError) throw partError;

    const totalOpportunities = opportunities?.length || 0;
    const activeOpportunities = opportunities?.filter((o) => o.status === "active").length || 0;
    const totalParticipation = participation?.length || 0;

    const statusBreakdown = {
      pending: participation?.filter((p) => p.status === "pending").length || 0,
      approved: participation?.filter((p) => p.status === "approved").length || 0,
      rejected: participation?.filter((p) => p.status === "rejected").length || 0,
    };

    const totalAmount = participation?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    let organizationStats = null;
    if (organizationId) {
      const orgParticipation = participation?.filter(
        (p) => p.organization_id === organizationId
      ) || [];

      organizationStats = {
        totalParticipation: orgParticipation.length,
        totalAmount: orgParticipation.reduce((sum, p) => sum + (p.amount || 0), 0),
        pendingCount: orgParticipation.filter((p) => p.status === "pending").length,
        approvedCount: orgParticipation.filter((p) => p.status === "approved").length,
      };
    }

    const report = {
      overview: {
        totalOpportunities,
        activeOpportunities,
        totalParticipation,
        totalAmount,
      },
      statusBreakdown,
      organizationStats,
      generatedAt: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(report),
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
