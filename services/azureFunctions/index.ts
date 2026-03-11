export interface DashboardPayloadResult<T> {
  data: T
  error: string | null
}

export interface DashboardPayload {
  isConfigured: boolean
  summary: DashboardPayloadResult<Record<string, unknown> | null>
  deals: DashboardPayloadResult<Array<Record<string, unknown>> | null>
  orders: DashboardPayloadResult<Array<Record<string, unknown>> | null>
  spvs: DashboardPayloadResult<Array<Record<string, unknown>> | null>
  charts: DashboardPayloadResult<Record<string, unknown> | null>
}

export const fetchDashboardPayload = async ({
  endpoint
}: {
  endpoint: string
}): Promise<DashboardPayload> => {
  if (!endpoint) {
    return {
      isConfigured: false,
      summary: { data: null, error: null },
      deals: { data: null, error: null },
      orders: { data: null, error: null },
      spvs: { data: null, error: null },
      charts: { data: null, error: null }
    }
  }

  try {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/api/dashboard`, {
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      const errorMessage = `Platform connection failed with status ${response.status}`
      return {
        isConfigured: true,
        summary: { data: null, error: errorMessage },
        deals: { data: null, error: errorMessage },
        orders: { data: null, error: errorMessage },
        spvs: { data: null, error: errorMessage },
        charts: { data: null, error: errorMessage }
      }
    }

    const body = await response.json()

    return {
      isConfigured: true,
      summary: {
        data: body.summary || null,
        error: null
      },
      deals: {
        data: Array.isArray(body.deals) ? body.deals : null,
        error: null
      },
      orders: {
        data: Array.isArray(body.orders) ? body.orders : null,
        error: null
      },
      spvs: {
        data: Array.isArray(body.spvs) ? body.spvs : null,
        error: null
      },
      charts: {
        data: body.charts || null,
        error: null
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      isConfigured: true,
      summary: { data: null, error: errorMessage },
      deals: { data: null, error: errorMessage },
      orders: { data: null, error: errorMessage },
      spvs: { data: null, error: errorMessage },
      charts: { data: null, error: errorMessage }
    }
  }
}
