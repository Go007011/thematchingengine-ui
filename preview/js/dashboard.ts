import ApexCharts from 'apexcharts'
import { Calendar } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import List from 'list.js'
import Quill from 'quill'
import { fetchDashboardPayload } from '../../services/azureFunctions/index'

const shell = document.querySelector<HTMLElement>('[data-module-shell]')
const statusNodes = document.querySelectorAll<HTMLElement>('[data-last-updated]')
const links = document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')
const statusBadge = document.querySelector<HTMLElement>('[data-api-status-badge]')
const statusLabel = document.querySelector<HTMLElement>('[data-api-status-label]')
const statusDetail = document.querySelector<HTMLElement>('[data-api-status-detail]')
const dashboardCards = document.querySelectorAll<HTMLElement>('[data-dashboard-card]')
const adminBuilderForm = document.querySelector<HTMLFormElement>('[data-admin-builder-form]')
const adminFeedback = document.querySelector<HTMLElement>('[data-admin-feedback]')
const adminSubmitButton = document.querySelector<HTMLButtonElement>('[data-admin-submit-button]')
const adminEditorHost = document.querySelector<HTMLElement>('[data-admin-editor]')
const adminEditorToolbar = document.querySelector<HTMLElement>('[data-admin-editor-toolbar]')
const adminDescriptionInput = document.querySelector<HTMLTextAreaElement>('#admin-description')
const calendarMount = document.querySelector<HTMLElement>('[data-deal-calendar]')
const calendarStatus = document.querySelector<HTMLElement>('[data-calendar-status]')
const calendarFeed = document.querySelector<HTMLElement>('[data-calendar-feed]')

const listInstances = new Map<string, any>()
const overviewCharts = new Map<string, ApexCharts>()
let dealCalendar: Calendar | null = null
let adminEditor: Quill | null = null

const formatStamp = (): string => {
  const now = new Date()
  return now.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatNumber = (value: unknown): string => {
  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    return '--'
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0
  }).format(numericValue)
}

const formatPercent = (value: unknown): string => {
  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    return '--'
  }

  return `${numericValue.toFixed(0)}%`
}

const formatCurrency = (value: unknown): string => {
  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    return '--'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(numericValue)
}

const formatDate = (value: unknown): string => {
  if (typeof value !== 'string' || !value) {
    return '--'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) {
    return '--'
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const sanitizeUiText = (value: unknown, fallback = '--') => {
  const source = String(value ?? '').trim()
  if (!source) {
    return fallback
  }

  return source
    .replace(/\bAzure\b/gi, 'Platform')
    .replace(/\bAPI\b/gi, 'system')
    .replace(/\bbackend\b/gi, 'platform')
    .replace(/\bFunctions\b/gi, 'services')
    .replace(/\bendpoint\b/gi, 'connection')
    .replace(/\bGoogle Sheets\b/gi, 'current data sources')
    .replace(/\benforcement engine\b/gi, 'platform services')
    .replace(/\bservice connectors\b/gi, 'platform connections')
    .replace(/\bdata pipeline\b/gi, 'current workflow')
    .replace(/\bSPV\b/gi, 'record')
}

const updateStatus = (label: string, detail: string, accent: 'blue' | 'green' | 'azure' = 'blue') => {
  if (statusLabel) {
    statusLabel.textContent = label
  }

  if (statusDetail) {
    statusDetail.textContent = detail
  }

  if (statusBadge) {
    statusBadge.className = `status-pill text-${accent}`
  }
}

const setCardContent = (cardKey: string, metric: string) => {
  const card = document.querySelector<HTMLElement>(`[data-dashboard-card="${cardKey}"]`)
  if (!card) {
    return
  }

  const metricNode = card.querySelector<HTMLElement>('[data-card-metric]')

  if (metricNode) {
    metricNode.textContent = metric
  }
}

const setText = (selector: string, value: string) => {
  document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
    node.textContent = value
  })
}

const renderSignalList = (
  selector: string,
  items: Array<{ title: string; detail: string; badge: string }>,
  emptyMessage: string
) => {
  const container = document.querySelector<HTMLElement>(selector)
  if (!container) {
    return
  }

  const resolvedItems =
    items.length > 0
      ? items
      : [
          {
            title: 'No live records available',
            detail: emptyMessage,
            badge: 'Fallback'
          }
        ]

  container.replaceChildren(
    ...resolvedItems.map((item) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'signal-item'

      const meta = document.createElement('div')
      meta.className = 'signal-meta'

      const title = document.createElement('strong')
      title.textContent = item.title

      const detail = document.createElement('span')
      detail.className = 'text-secondary small'
      detail.textContent = item.detail

      const badge = document.createElement('span')
      badge.className = 'badge bg-blue-lt text-blue'
      badge.textContent = item.badge

      meta.append(title, detail)
      wrapper.append(meta, badge)

      return wrapper
    })
  )
}

const createEmptyCard = (title: string, subtitle: string, metric = '0'): HTMLElement => {
  const card = document.createElement('article')
  card.className = 'card'

  const body = document.createElement('div')
  body.className = 'card-body'

  const empty = document.createElement('div')
  empty.className = 'empty'

  const emptyHeader = document.createElement('div')
  emptyHeader.className = 'empty-header'
  emptyHeader.textContent = metric

  const emptyTitle = document.createElement('p')
  emptyTitle.className = 'empty-title'
  emptyTitle.textContent = title

  const emptySubtitle = document.createElement('p')
  emptySubtitle.className = 'empty-subtitle text-secondary'
  emptySubtitle.textContent = subtitle

  empty.append(emptyHeader, emptyTitle, emptySubtitle)
  body.append(empty)
  card.append(body)

  return card
}

const decoratePagination = (container: HTMLElement) => {
  container.querySelectorAll<HTMLLIElement>('.pagination li').forEach((item) => {
    item.classList.add('page-item')
  })

  container.querySelectorAll<HTMLAnchorElement>('.pagination a').forEach((link) => {
    link.classList.add('page-link')
  })
}

const renderListTable = ({
  container,
  key,
  title,
  subtitle,
  tableClass,
  columns,
  sortActions,
  rows,
  pageSize = 8
}: {
  container: HTMLElement
  key: string
  title: string
  subtitle: string
  tableClass: string
  columns: string[]
  sortActions: Array<{ label: string; field: string }>
  rows: string[]
  pageSize?: number
}) => {
  if (rows.length === 0) {
    container.replaceChildren(
      createEmptyCard(
        `No ${title.toLowerCase()} yet.`,
        `The current platform activity has not returned any ${title.toLowerCase()} records.`
      )
    )
    return
  }

  container.innerHTML = `
    <article class="card dashboard-table-shell">
      <div class="card-header">
        <div>
          <h3 class="card-title">${escapeHtml(title)}</h3>
          <div class="text-secondary small">${escapeHtml(subtitle)}</div>
        </div>
      </div>
      <div class="card-body">
        <div class="dashboard-table-toolbar" data-list-root>
          <label class="input-icon">
            <span class="input-icon-addon">
              <i class="ti ti-search" aria-hidden="true"></i>
            </span>
            <input class="form-control search" type="search" placeholder="Search ${escapeHtml(title.toLowerCase())}" />
          </label>
          <div class="btn-list">
            ${sortActions
              .map(
                (action) =>
                  `<button class="btn btn-outline-secondary btn-sm sort" type="button" data-sort="${escapeHtml(action.field)}">${escapeHtml(action.label)}</button>`
              )
              .join('')}
          </div>
        </div>
        <div class="table-responsive">
          <table class="table table-vcenter card-table ${escapeHtml(tableClass)}">
            <thead>
              <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
            </thead>
            <tbody class="list">
              ${rows.join('')}
            </tbody>
          </table>
        </div>
        <div class="d-flex justify-content-between align-items-center mt-3">
          <div class="text-secondary small">${rows.length} records</div>
          <ul class="pagination mb-0"></ul>
        </div>
      </div>
    </article>
  `

  const root = container.querySelector<HTMLElement>('[data-list-root]')?.parentElement
  if (!root) {
    return
  }

  const instance = new List(root, {
    listClass: 'list',
    valueNames: sortActions.map((action) => action.field),
    page: pageSize,
    pagination: [
      {
        paginationClass: 'pagination',
        innerWindow: 1,
        outerWindow: 1
      }
    ]
  })

  decoratePagination(root)
  instance.on('updated', () => {
    decoratePagination(root)
  })
  listInstances.set(key, instance)
}

const renderOpportunityCards = (deals: Array<Record<string, unknown>>) => {
  const container = document.querySelector<HTMLElement>('[data-opportunities-grid]')
  if (!container) {
    return
  }

  if (deals.length === 0) {
    const column = document.createElement('div')
    column.className = 'col-12'
    column.append(
      createEmptyCard(
        'No opportunities currently available.',
        'No active opportunities are currently available for this pipeline.'
      )
    )
    container.replaceChildren(column)
    return
  }

  const cards = deals.map((deal) => {
    const column = document.createElement('div')
    column.className = 'col-sm-6 col-xl-4'

    const card = document.createElement('article')
    card.className = 'card h-100'

    const body = document.createElement('div')
    body.className = 'card-body'

    const title = document.createElement('h3')
    title.className = 'card-title mb-3'
    title.textContent = sanitizeUiText(deal.title || deal.dealId, 'Untitled opportunity')

    const location = document.createElement('div')
    location.className = 'text-secondary mb-2'
    const locationParts = [deal.city, deal.state].filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    )
    location.textContent = String(
      deal.propertyAddress || (locationParts.length > 0 ? locationParts.join(', ') : 'Location unavailable')
    )

    const capitalRequired = document.createElement('p')
    capitalRequired.className = 'mb-2'
    capitalRequired.innerHTML = `<span class="fw-semibold">Capital Required: </span>${escapeHtml(formatCurrency(deal.capitalRequired))}`

    const participationStatus = document.createElement('p')
    participationStatus.className = 'mb-2'
    const participationText =
      deal.sentMail === true
        ? 'Investor outreach active'
        : deal.sentMail === false
          ? 'Investor outreach pending'
          : String(deal.status || 'Participation pending')
    participationStatus.innerHTML = `<span class="fw-semibold">Participation: </span>${escapeHtml(participationText)}`

    const stage = document.createElement('p')
    stage.className = 'text-secondary mb-0'
    stage.innerHTML = `<span class="fw-semibold text-body">Stage: </span>${escapeHtml(String(deal.status || deal.buyboxType || 'Pipeline review'))}`

    body.append(title, location, capitalRequired, participationStatus, stage)
    card.append(body)
    column.append(card)

    return column
  })

  container.replaceChildren(...cards)
}

const renderOpportunityTable = (deals: Array<Record<string, unknown>>) => {
  const container = document.querySelector<HTMLElement>('[data-opportunities-table]')
  if (!container) {
    return
  }

  const rows = deals.map((deal) => {
    const dealName = sanitizeUiText(deal.title || deal.dealId, 'Untitled opportunity')
    const location = String(deal.propertyAddress || deal.state || 'Location unavailable')
    const capitalRaw = Number(deal.capitalRequired || 0)
    const capital = formatCurrency(deal.capitalRequired)
    const participation =
      deal.sentMail === true ? 'Outreach active' : deal.sentMail === false ? 'Outreach pending' : String(deal.status || 'Pending')
    const stage = String(deal.status || deal.buyboxType || 'Pipeline review')

    return `
      <tr>
        <td><span class="dealName">${escapeHtml(dealName)}</span></td>
        <td><span class="location">${escapeHtml(location)}</span></td>
        <td><span class="capital d-none">${escapeHtml(capitalRaw)}</span><span>${escapeHtml(capital)}</span></td>
        <td><span class="participation">${escapeHtml(participation)}</span></td>
        <td><span class="stage">${escapeHtml(stage)}</span></td>
      </tr>
    `
  })

  renderListTable({
    container,
    key: 'opportunities',
    title: 'Opportunity table',
    subtitle: 'Searchable and sortable deal pipeline view.',
    tableClass: 'dashboard-opportunities-table',
    columns: ['Deal', 'Location', 'Capital Required', 'Participation', 'Stage'],
    sortActions: [
      { label: 'Sort by deal', field: 'dealName' },
      { label: 'Sort by stage', field: 'stage' },
      { label: 'Sort by capital', field: 'capital' }
    ],
    rows
  })
}

const renderParticipationRecords = (orders: Array<Record<string, unknown>>) => {
  const container = document.querySelector<HTMLElement>('[data-participation-grid]')
  if (!container) {
    return
  }

  const rows = orders.map((order) => {
    const investor = sanitizeUiText(order.investorName || order.contactName || order.email, 'Unknown investor')
    const deal = sanitizeUiText(order.dealName || order.title || order.dealId, 'Unknown deal')
    const amountRaw = Number(order.amount ?? order.committedAmount ?? 0)
    const amount = formatCurrency(order.amount ?? order.committedAmount)
    const dateRaw = String(order.participationDate || order.createdAt || order.updatedAt || order.timestamp || '')
    const date = formatDate(order.participationDate || order.createdAt || order.updatedAt || order.timestamp)
    const reference = sanitizeUiText(order.orderId || order.dealId || order.updatedAt, '--')

    return `
      <tr>
        <td><span class="investor">${escapeHtml(investor)}</span></td>
        <td><span class="deal">${escapeHtml(deal)}</span></td>
        <td><span class="amount d-none">${escapeHtml(amountRaw)}</span><span>${escapeHtml(amount)}</span></td>
        <td><span class="participationDate d-none">${escapeHtml(dateRaw)}</span><span>${escapeHtml(date)}</span></td>
        <td><span class="spv">${escapeHtml(reference)}</span></td>
      </tr>
    `
  })

  renderListTable({
    container,
    key: 'participation',
    title: 'Participation records',
    subtitle: 'Search, sort, and page through incoming participation records.',
    tableClass: 'dashboard-participation-table',
    columns: ['Investor name', 'Deal name', 'Amount committed', 'Participation date', 'Reference'],
    sortActions: [
      { label: 'Sort by investor', field: 'investor' },
      { label: 'Sort by deal', field: 'deal' },
      { label: 'Sort by amount', field: 'amount' }
    ],
    rows
  })
}

const resolveDocumentRecords = (
  documents: Array<Record<string, unknown>>,
  deals: Array<Record<string, unknown>>,
  orders: Array<Record<string, unknown>>
) =>
  documents.length > 0
    ? documents
    : [
        ...orders.map((order) => ({
      documentName: `${sanitizeUiText(order.dealName || order.dealId, 'Deal')} participation record`,
      dealReference: sanitizeUiText(order.dealName || order.dealId, 'Unknown deal'),
          documentType: String(order.documentType || 'Participation'),
          status: String(order.status || 'Pending review'),
          lastUpdated: order.updatedAt || order.createdAt || order.participationDate || order.timestamp
        })),
        ...deals
          .filter((deal) => {
            const dealReference = deal.dealId || deal.spvId
            if (!dealReference) {
              return true
            }

            return !orders.some((order) => {
              const orderReference = order.dealId || order.spvId
              return orderReference ? orderReference === dealReference : false
            })
          })
          .map((deal) => ({
      documentName: `${sanitizeUiText(deal.title || deal.dealId, 'Deal')} diligence record`,
      dealReference: sanitizeUiText(deal.title || deal.dealId, 'Unknown deal'),
            documentType: String(deal.documentType || deal.buyboxType || 'Diligence'),
            status: String(deal.documentStatus || deal.status || 'Pending review'),
            lastUpdated: deal.updatedAt || deal.createdAt || deal.lastUpdated
          }))
      ]

const renderDocumentRecords = (
  documents: Array<Record<string, unknown>>,
  deals: Array<Record<string, unknown>>,
  orders: Array<Record<string, unknown>>
) => {
  const container = document.querySelector<HTMLElement>('[data-documents-grid]')
  if (!container) {
    return
  }

  const derivedDocuments = resolveDocumentRecords(documents, deals, orders)
  const rows = derivedDocuments.map((documentRecord) => {
    const name = String(documentRecord.documentName || documentRecord.name || documentRecord.title || 'Unnamed document')
    const deal = sanitizeUiText(documentRecord.dealReference || documentRecord.dealName || documentRecord.dealId, '--')
    const type = String(documentRecord.documentType || documentRecord.type || 'General')
    const status = String(documentRecord.status || 'Pending review')
    const updatedRaw = String(documentRecord.lastUpdated || documentRecord.updatedAt || documentRecord.createdAt || '')
    const updated = formatDate(documentRecord.lastUpdated || documentRecord.updatedAt || documentRecord.createdAt)

    return `
      <tr>
        <td><span class="documentName">${escapeHtml(name)}</span></td>
        <td><span class="dealReference">${escapeHtml(deal)}</span></td>
        <td><span class="documentType">${escapeHtml(type)}</span></td>
        <td><span class="status">${escapeHtml(status)}</span></td>
        <td><span class="lastUpdated d-none">${escapeHtml(updatedRaw)}</span><span>${escapeHtml(updated)}</span></td>
      </tr>
    `
  })

  renderListTable({
    container,
    key: 'documents',
    title: 'Document records',
    subtitle: 'Sortable document center for diligence and participation records.',
    tableClass: 'dashboard-documents-table',
    columns: ['Document name', 'Deal reference', 'Document type', 'Status', 'Last updated'],
    sortActions: [
      { label: 'Sort by document', field: 'documentName' },
      { label: 'Sort by deal', field: 'dealReference' },
      { label: 'Sort by status', field: 'status' }
    ],
    rows
  })
}

const renderNotificationRecords = (
  deals: Array<Record<string, unknown>>,
  orders: Array<Record<string, unknown>>,
  documents: Array<Record<string, unknown>>,
  warnings: string[],
  latestUpdatedAt: unknown
) => {
  const container = document.querySelector<HTMLElement>('[data-notifications-grid]')
  if (!container) {
    return
  }

  const alerts = [
    ...warnings.map((warning) => ({
      alert: warning,
      relatedDeal: 'System summary',
      type: 'System Alert',
      timestamp: latestUpdatedAt
    })),
    ...orders.map((order) => ({
      alert: `Participation received from ${sanitizeUiText(order.investorName || order.contactName, 'capital partner')}`,
      relatedDeal: sanitizeUiText(order.dealName || order.dealId, 'Unknown deal'),
      type: 'Capital Event',
      timestamp: order.participationDate || order.createdAt || order.updatedAt || order.timestamp || latestUpdatedAt
    })),
    ...documents.map((documentRecord) => ({
      alert: `Document status changed to ${String(documentRecord.status || 'Pending review')}`,
      relatedDeal: sanitizeUiText(
        documentRecord.dealReference ||
          documentRecord.dealName ||
          documentRecord.dealId ||
          'Unknown deal'
      ),
      type: 'Document Update',
      timestamp:
        documentRecord.lastUpdated || documentRecord.updatedAt || documentRecord.createdAt || latestUpdatedAt
    })),
    ...deals.map((deal) => ({
      alert: `Deal stage updated to ${String(deal.status || deal.buyboxType || 'Pipeline review')}`,
      relatedDeal: sanitizeUiText(deal.title || deal.dealId, 'Unknown deal'),
      type: 'Pipeline Update',
      timestamp: deal.updatedAt || deal.createdAt || deal.lastUpdated || latestUpdatedAt
    }))
  ].filter((alert) => Boolean(alert.alert))

  if (alerts.length === 0) {
    container.replaceChildren(
      createEmptyCard('No system alerts.', 'Current platform activity has not produced any alert activity yet.')
    )
    return
  }

  const card = document.createElement('article')
  card.className = 'card'

  const header = document.createElement('div')
  header.className = 'card-header'

  const title = document.createElement('h3')
  title.className = 'card-title'
  title.textContent = 'Alert activity'

  header.append(title)

  const tableResponsive = document.createElement('div')
  tableResponsive.className = 'table-responsive'

  const table = document.createElement('table')
  table.className = 'table table-vcenter card-table'

  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  ;['Alert', 'Related Deal', 'Type', 'Timestamp'].forEach((label) => {
    const th = document.createElement('th')
    th.textContent = label
    headRow.append(th)
  })
  thead.append(headRow)

  const tbody = document.createElement('tbody')

  alerts.forEach((notification) => {
    const row = document.createElement('tr')

    const alertCell = document.createElement('td')
    alertCell.textContent = notification.alert

    const dealCell = document.createElement('td')
    dealCell.textContent = notification.relatedDeal

    const typeCell = document.createElement('td')
    typeCell.textContent = notification.type

    const timestampCell = document.createElement('td')
    timestampCell.textContent = formatDate(notification.timestamp)

    row.append(alertCell, dealCell, typeCell, timestampCell)
    tbody.append(row)
  })

  table.append(thead, tbody)
  tableResponsive.append(table)
  card.append(header, tableResponsive)
  container.replaceChildren(card)
}

const buildLineChartSeries = (
  summary: Record<string, unknown> | null,
  charts: Record<string, unknown>
): { categories: string[]; values: number[] } => {
  const monthlyInvestmentVolume = Array.isArray(charts.monthlyInvestmentVolume)
    ? charts.monthlyInvestmentVolume
    : []

  if (monthlyInvestmentVolume.length > 0) {
    return {
      categories: monthlyInvestmentVolume.map((item) => String(item.label || 'Period')),
      values: monthlyInvestmentVolume.map((item) => Number(item.value || 0))
    }
  }

  if (summary) {
    return {
      categories: ['Deals', 'Active', 'Orders', 'Investors', 'Groups', 'Warnings'],
      values: [
        Number(summary.totalDeals ?? 0),
        Number(summary.activeDeals ?? 0),
        Number(summary.totalOrders ?? 0),
        Number(summary.totalInvestors ?? 0),
        Number(summary.totalSPVs ?? summary.totalSpvs ?? 0),
        Array.isArray(summary.warnings) ? summary.warnings.length : 0
      ]
    }
  }

  return {
    categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    values: [12, 18, 16, 24, 20, 28]
  }
}

const buildTrafficSeries = (
  charts: Record<string, unknown>
): { categories: string[]; values: number[] } => {
  const dealsByState = Array.isArray(charts.dealsByState) ? charts.dealsByState : []

  if (dealsByState.length > 0) {
    return {
      categories: dealsByState.slice(0, 6).map((item) => String(item.label || 'State')),
      values: dealsByState.slice(0, 6).map((item) => Number(item.value || 0))
    }
  }

  return {
    categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    values: [4, 7, 5, 8, 6, 9]
  }
}

const upsertChart = (key: string, targetSelector: string, options: ApexCharts.ApexOptions) => {
  const target = document.querySelector<HTMLElement>(targetSelector)
  if (!target) {
    return
  }

  overviewCharts.get(key)?.destroy()
  target.replaceChildren()

  const chart = new ApexCharts(target, options)
  overviewCharts.set(key, chart)
  void chart.render()
}

const renderPipelineActivityChart = (summary: Record<string, unknown> | null, charts: Record<string, unknown>) => {
  const primary = getComputedStyle(document.documentElement).getPropertyValue('--tblr-primary').trim() || '#206bc4'
  const success = getComputedStyle(document.documentElement).getPropertyValue('--tblr-success').trim() || '#2fb344'
  const info = getComputedStyle(document.documentElement).getPropertyValue('--tblr-info').trim() || '#4299e1'
  const axisColor = 'rgba(82, 95, 127, 0.72)'

  const pipelineData = buildLineChartSeries(summary, charts)

  upsertChart('pipeline-activity', '#chart-pipeline-activity', {
    chart: {
      type: 'area',
      height: 320,
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'Geist, sans-serif'
    },
    stroke: {
      curve: 'smooth',
      width: 2
    },
    series: [
      {
        name: 'Pipeline Activity',
        data: pipelineData.values
      }
    ],
    colors: [primary],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.1,
        stops: [0, 90, 100]
      }
    },
    grid: {
      borderColor: 'rgba(0, 0, 0, 0.05)',
      strokeDashArray: 4
    },
    dataLabels: {
      enabled: false
    },
    xaxis: {
      categories: pipelineData.categories,
      labels: {
        style: {
          colors: pipelineData.categories.map(() => axisColor),
          fontSize: '12px'
        }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: {
          colors: [axisColor],
          fontSize: '12px'
        }
      }
    },
    tooltip: {
      theme: 'light',
      x: {
        show: true
      }
    }
  })
}

const renderOverviewCharts = (summary: Record<string, unknown> | null, charts: Record<string, unknown>) => {
  const primary = getComputedStyle(document.documentElement).getPropertyValue('--tblr-primary').trim() || '#206bc4'
  const success = getComputedStyle(document.documentElement).getPropertyValue('--tblr-success').trim() || '#2fb344'
  const axisColor = 'rgba(82, 95, 127, 0.72)'
  const borderColor = 'rgba(23, 71, 199, 0.12)'

  const usersTrend = buildLineChartSeries(summary, charts)
  const trafficTrend = buildTrafficSeries(charts)

  upsertChart('users', '#chart-users', {
    chart: {
      type: 'line',
      height: 240,
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'Manrope, sans-serif'
    },
    stroke: {
      curve: 'smooth',
      width: 3
    },
    series: [
      {
        name: 'Trend',
        data: usersTrend.values
      }
    ],
    colors: [primary],
    grid: {
      show: false
    },
    dataLabels: {
      enabled: false
    },
    xaxis: {
      categories: usersTrend.categories,
      labels: {
        style: {
          colors: usersTrend.categories.map(() => axisColor)
        }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: {
          colors: [axisColor]
        }
      }
    },
    tooltip: {
      theme: 'light'
    }
  })

  upsertChart('traffic', '#chart-traffic', {
    chart: {
      type: 'bar',
      height: 240,
      toolbar: { show: false },
      fontFamily: 'Manrope, sans-serif'
    },
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: '48%'
      }
    },
    series: [
      {
        name: 'Volume',
        data: trafficTrend.values
      }
    ],
    colors: [success],
    grid: {
      show: false
    },
    dataLabels: {
      enabled: false
    },
    xaxis: {
      categories: trafficTrend.categories,
      labels: {
        style: {
          colors: trafficTrend.categories.map(() => axisColor)
        }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: {
          colors: [axisColor]
        }
      }
    },
    tooltip: {
      theme: 'light'
    },
    stroke: {
      show: true,
      width: 1,
      colors: [borderColor]
    }
  })
}

const setAdminFeedback = (
  tone: 'success' | 'danger' | 'info',
  message: string,
  details: string[] = []
) => {
  if (!adminFeedback) {
    return
  }

  adminFeedback.hidden = false
  adminFeedback.className = `alert alert-${tone} mb-3`
  adminFeedback.replaceChildren()

  const messageNode = document.createElement('div')
  messageNode.textContent = message
  adminFeedback.append(messageNode)

  if (details.length > 0) {
    const list = document.createElement('ul')
    list.className = 'mb-0 mt-2'

    details.forEach((detail) => {
      const item = document.createElement('li')
      item.textContent = detail
      list.append(item)
    })

    adminFeedback.append(list)
  }
}

const clearAdminFeedback = () => {
  if (!adminFeedback) {
    return
  }

  adminFeedback.hidden = true
  adminFeedback.className = 'mb-3'
  adminFeedback.replaceChildren()
}

const syncAdminEditorValue = () => {
  if (!adminEditor || !adminDescriptionInput) {
    return
  }

  const html = adminEditor.root.innerHTML
  adminDescriptionInput.value = html === '<p><br></p>' ? '' : html.trim()
}

const initializeAdminEditor = () => {
  if (!adminEditorHost || !adminDescriptionInput || adminEditor) {
    return
  }

  adminEditor = new Quill(adminEditorHost, {
    modules: {
      toolbar: adminEditorToolbar || true
    },
    placeholder: 'Describe the opportunity, timeline, and investor fit.'
  })

  adminEditor.on('text-change', syncAdminEditorValue)

  if (adminDescriptionInput.value) {
    adminEditor.clipboard.dangerouslyPasteHTML(adminDescriptionInput.value)
  }

  syncAdminEditorValue()
}

const parseNumericInput = (value: FormDataEntryValue | null): number => {
  const normalized = String(value ?? '')
    .replace(/[^0-9.-]/g, '')
    .trim()
  const numericValue = Number(normalized)

  return Number.isFinite(numericValue) ? numericValue : Number.NaN
}

const renderCalendarFeed = (items: Array<{ title: string; detail: string; badge: string }>) => {
  if (!calendarFeed) {
    return
  }

  if (items.length === 0) {
    renderSignalList(
      '[data-calendar-feed]',
      [],
      'No lifecycle events are available until dashboard and enforcement signals are returned.'
    )
    return
  }

  renderSignalList('[data-calendar-feed]', items, 'No lifecycle events are available yet.')
}

const renderCalendarModule = async (
  deals: Array<Record<string, unknown>>,
  orders: Array<Record<string, unknown>>,
  enforcementEndpoint: string,
  latestUpdatedAt: unknown
) => {
  if (!calendarMount) {
    return
  }

  const fallbackDate = typeof latestUpdatedAt === 'string' && latestUpdatedAt ? new Date(latestUpdatedAt) : new Date()
  const capitalChecks: Array<Record<string, unknown>> = []
  let capitalCheckMessage = 'Using current lifecycle markers.'

  if (enforcementEndpoint) {
    try {
      const response = await fetch(`${enforcementEndpoint.replace(/\/$/, '')}/api/capital-check`, {
        headers: {
          Accept: 'application/json'
        }
      })

      if (response.ok) {
        const body = (await response.json()) as { checks?: Array<Record<string, unknown>> }
        if (Array.isArray(body.checks)) {
          capitalChecks.push(...body.checks)
          capitalCheckMessage = 'Capital check events loaded from platform services.'
        }
      } else {
        capitalCheckMessage = 'Capital check source unavailable, using dashboard events only.'
      }
    } catch {
      capitalCheckMessage = 'Capital check source unavailable, using dashboard events only.'
    }
  } else {
    capitalCheckMessage = 'Platform connection not configured, using dashboard events only.'
  }

  const events = [
    ...deals.slice(0, 10).map((deal, index) => {
      const title = sanitizeUiText(deal.title || deal.dealId, `Deal ${index + 1}`)
      const eventDate =
        typeof deal.updatedAt === 'string' && deal.updatedAt
          ? deal.updatedAt
          : new Date(fallbackDate.getTime() + index * 86400000).toISOString()
      return {
        title: `Deal review: ${title}`,
        start: eventDate,
        allDay: true,
        color: '#206bc4'
      }
    }),
    ...orders.slice(0, 10).map((order, index) => {
      const dealName = sanitizeUiText(order.dealName || order.dealId || order.orderId, `Participation ${index + 1}`)
      const eventDate =
        typeof order.createdAt === 'string' && order.createdAt
          ? order.createdAt
          : new Date(fallbackDate.getTime() + (index + 1) * 86400000).toISOString()
      return {
        title: `Participation follow-up: ${dealName}`,
        start: eventDate,
        allDay: true,
        color: '#2fb344'
      }
    }),
    ...capitalChecks
      .filter((item) => String(item.status || '').toUpperCase() === 'DEFICIENT')
      .slice(0, 10)
      .map((item, index) => ({
        title: `Capital gap: ${sanitizeUiText(item.spv_name || item.spv_id, `Record ${index + 1}`)}`,
        start: new Date(fallbackDate.getTime() + (index + 2) * 86400000).toISOString(),
        allDay: true,
        color: '#d63939'
      }))
  ]

  dealCalendar?.destroy()
  dealCalendar = new Calendar(calendarMount, {
    plugins: [dayGridPlugin, listPlugin],
    initialView: 'dayGridMonth',
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,listWeek'
    },
    events
  })
  dealCalendar.render()

  if (calendarStatus) {
    calendarStatus.className = 'alert alert-info mb-4'
    calendarStatus.textContent = capitalCheckMessage
  }

  renderCalendarFeed([
    {
      title: 'Capital checks',
      detail: `${formatNumber(capitalChecks.length)} checks loaded`,
      badge: enforcementEndpoint ? 'Live' : 'Fallback'
    },
    {
      title: 'Deal review events',
      detail: `${formatNumber(deals.length)} deal markers mapped into the calendar`,
      badge: 'Dashboard'
    },
    {
      title: 'Participation follow-ups',
      detail: `${formatNumber(orders.length)} order records surfaced as follow-up events`,
      badge: 'Dashboard'
    }
  ])
}

const loadDashboardData = async (endpoint: string, enforcementEndpoint = '') => {
  updateStatus(
    endpoint ? 'Connecting to platform' : 'System connection not configured',
    endpoint
      ? 'Loading current platform activity.'
      : 'Set the system connection to enable live dashboard data.',
    endpoint ? 'azure' : 'blue'
  )

  if (!endpoint) {
    renderSignalList(
      '[data-api-list="warnings"]',
      [],
      'The dashboard is using built-in shell content until the system connection is configured.'
    )
    renderPipelineActivityChart(null, {})
    renderOverviewCharts(null, {})
    renderOpportunityCards([])
    renderOpportunityTable([])
    renderParticipationRecords([])
    renderDocumentRecords([], [], [])
    renderNotificationRecords([], [], [], [], null)
    await renderCalendarModule([], [], enforcementEndpoint, null)
    return
  }

  const payload = await fetchDashboardPayload({
    endpoint
  })

  if (!payload.isConfigured) {
    renderSignalList(
      '[data-api-list="warnings"]',
      [],
      'The dashboard is using built-in shell content until the system connection is configured.'
    )
    renderPipelineActivityChart(null, {})
    renderOverviewCharts(null, {})
    renderOpportunityCards([])
    renderOpportunityTable([])
    renderParticipationRecords([])
    renderDocumentRecords([], [], [])
    renderNotificationRecords([], [], [], [], null)
    await renderCalendarModule([], [], enforcementEndpoint, null)
    return
  }

  const hasLiveData = [payload.summary, payload.deals, payload.orders, payload.spvs, payload.charts].some(
    (result) => result.data !== null
  )
  const connectedDatasets = [payload.summary, payload.deals, payload.orders, payload.spvs, payload.charts].filter(
    (result) => result.data !== null
  ).length

  if (!hasLiveData) {
    updateStatus(
      'Platform temporarily unavailable',
      sanitizeUiText(payload.summary.error || payload.deals.error, 'Dashboard shell is using built-in fallback content.'),
      'blue'
    )
    renderSignalList(
      '[data-api-list="warnings"]',
      [],
      'Live platform activity could not be reached, so the dashboard stayed on its fallback shell content.'
    )
    renderPipelineActivityChart(null, {})
    renderOverviewCharts(null, {})
    renderOpportunityCards([])
    renderOpportunityTable([])
    renderParticipationRecords([])
    renderDocumentRecords([], [], [])
    renderNotificationRecords([], [], [], [], null)
    applyOverviewCards(null, {
      connectedDatasets: 0,
      warningCount: 0,
      endpointConfigured: payload.isConfigured
    })
    await renderCalendarModule([], [], enforcementEndpoint, null)
    return
  }

  updateStatus(
    'Platform Connected',
    'Live dashboard data loaded successfully.',
    'green'
  )

  applySummary(payload.summary.data)

  const deals = Array.isArray(payload.deals.data) ? payload.deals.data : []
  const orders = Array.isArray(payload.orders.data) ? payload.orders.data : []
  const spvs = Array.isArray(payload.spvs.data) ? payload.spvs.data : []
  const charts =
    payload.charts.data && typeof payload.charts.data === 'object' ? payload.charts.data : {}
  const warnings =
    payload.summary.data && Array.isArray(payload.summary.data.warnings)
      ? (payload.summary.data.warnings as string[])
      : []
  const summaryDocuments =
    payload.summary.data && Array.isArray(payload.summary.data.documents)
      ? (payload.summary.data.documents as Array<Record<string, unknown>>)
      : []
  const latestUpdatedAt = payload.summary.data?.latestUpdatedAt ?? payload.summary.data?.lastUpdated ?? null

  applyOverviewCards(payload.summary.data, {
    connectedDatasets,
    warningCount: warnings.length,
    endpointConfigured: payload.isConfigured
  })
  renderPipelineActivityChart(payload.summary.data, charts)
  renderOverviewCharts(payload.summary.data, charts)
  renderOpportunityCards(deals)
  renderOpportunityTable(deals)
  renderParticipationRecords(orders)
  renderDocumentRecords(summaryDocuments, deals, orders)
  renderNotificationRecords(deals, orders, summaryDocuments, warnings, latestUpdatedAt)
  await renderCalendarModule(deals, orders, enforcementEndpoint, latestUpdatedAt)

  renderSignalList(
    '[data-api-list="deals"]',
    deals.slice(0, 3).map((deal) => ({
      title: sanitizeUiText(deal.title || deal.dealId, 'Untitled deal'),
      detail: `${deal.status || 'Unknown status'} | ${formatCurrency(deal.capitalRequired)} required | ${deal.state || 'Unknown state'}`,
      badge: String(deal.buyboxType || 'Deal')
    })),
    'No deal records are available right now.'
  )

  renderSignalList(
    '[data-api-list="orders"]',
    orders.slice(0, 3).map((order) => ({
      title: sanitizeUiText(order.investorName || order.orderId, 'Unknown investor'),
      detail: `${sanitizeUiText(order.dealName || order.dealId, 'Unknown deal')} | ${formatCurrency(order.amount)} | ${order.status || 'Pending'}`,
      badge: String(order.orderId || 'Order')
    })),
    'No participation records are available right now.'
  )

  renderSignalList(
    '[data-api-list="spvs"]',
    spvs.slice(0, 3).map((spv) => ({
      title: sanitizeUiText(spv.name || spv.dealId || spv.recordId, 'Unknown record'),
      detail: `${formatCurrency(spv.totalRaised)} raised | ${formatNumber(spv.investorCount)} investors | ${spv.status || 'Unknown status'}`,
      badge: `${formatNumber(spv.fundingProgressPercent)}%`
    })),
    'No grouped funding records are available right now.'
  )

  renderSignalList(
    '[data-api-list="warnings"]',
    warnings.slice(0, 3).map((warning) => ({
      title: 'Dashboard warning',
      detail: warning,
      badge: 'Review'
    })),
    'No system alerts are available right now.'
  )

  const dealsByState = Array.isArray(charts.dealsByState) ? charts.dealsByState : []
  renderSignalList(
    '[data-api-list="charts"]',
    dealsByState.slice(0, 3).map((item) => ({
      title: String(item.label || 'Unknown state'),
      detail: `Deals in state bucket: ${formatNumber(item.value)}`,
      badge: 'Chart'
    })),
    'No chart activity is available right now.'
  )
}

const initializeAdminBuilder = (enforcementEndpoint: string, readEndpoint: string) => {
  if (!adminBuilderForm) {
    return
  }

  initializeAdminEditor()

  adminBuilderForm.addEventListener('reset', () => {
    clearAdminFeedback()

    window.setTimeout(() => {
      if (!adminEditor) {
        return
      }

      adminEditor.setText('')
      syncAdminEditorValue()
    }, 0)
  })

  adminBuilderForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    clearAdminFeedback()
    syncAdminEditorValue()

    if (!enforcementEndpoint) {
      setAdminFeedback('danger', 'Platform submission is not configured.')
      return
    }

    const formData = new FormData(adminBuilderForm)
    const capitalRequired = parseNumericInput(formData.get('capital_required'))
    const purchasePrice = parseNumericInput(formData.get('purchase_price'))
    const expectedRoi = parseNumericInput(formData.get('expected_roi'))

    if (![capitalRequired, purchasePrice, expectedRoi].every((value) => Number.isFinite(value))) {
      setAdminFeedback(
        'danger',
        'Numeric fields must contain valid numbers.',
        ['Capital required, purchase price, and expected ROI must all be valid numeric values.']
      )
      return
    }

    const payload = {
      title: String(formData.get('title') || '').trim(),
      description: String(formData.get('description') || '').trim(),
      location: String(formData.get('location') || '').trim(),
      deal_type: String(formData.get('deal_type') || '').trim(),
      purchase_price: purchasePrice,
      capital_required: capitalRequired,
      expected_roi: expectedRoi,
      status: String(formData.get('status') || 'INTAKE').trim()
    }

    if (adminSubmitButton) {
      adminSubmitButton.disabled = true
      adminSubmitButton.textContent = 'Creating...'
    }

    try {
      const response = await fetch(`${enforcementEndpoint.replace(/\/$/, '')}/api/opportunities`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      let responseBody: Record<string, unknown> | null = null
      try {
        responseBody = (await response.json()) as Record<string, unknown>
      } catch {
        responseBody = null
      }

      if (!response.ok) {
        const details = Array.isArray(responseBody?.missingFields)
          ? responseBody.missingFields.map((field) => String(field))
          : []
        setAdminFeedback(
          'danger',
          String(responseBody?.error || `Opportunity creation failed with status ${response.status}.`),
          details.length > 0 ? [`Missing or invalid fields: ${details.join(', ')}`] : []
        )
        return
      }

      adminBuilderForm.reset()
      setAdminFeedback(
        'success',
        `Opportunity created successfully${responseBody?.opportunity && typeof responseBody.opportunity === 'object' ? `: ${String((responseBody.opportunity as Record<string, unknown>).title || payload.title)}` : '.'}`
      )
      await loadDashboardData(readEndpoint, enforcementEndpoint)
    } catch (error) {
      setAdminFeedback(
        'danger',
        error instanceof Error
          ? sanitizeUiText(error.message, 'The platform submission could not be completed.')
          : 'The platform submission could not be completed.'
      )
    } finally {
      if (adminSubmitButton) {
        adminSubmitButton.disabled = false
        adminSubmitButton.textContent = 'Create Opportunity'
      }
    }
  })
}

statusNodes.forEach((node) => {
  node.textContent = formatStamp()
})

links.forEach((link) => {
  link.addEventListener('click', () => {
    if (!shell) {
      return
    }

    shell.classList.add('module-shell-loading')
    window.setTimeout(() => {
      shell.classList.remove('module-shell-loading')
    }, 900)
  })
})

const applySummary = (summary: Record<string, unknown> | null) => {
  if (!summary) {
    return
  }

  setText('[data-summary-field="totalDeals"]', formatNumber(summary.totalDeals))
  setText('[data-summary-field="activeDeals"]', formatNumber(summary.activeDeals))
  setText('[data-summary-field="totalOrders"]', formatNumber(summary.totalOrders))
  setText('[data-summary-field="totalInvestors"]', formatNumber(summary.totalInvestors))
  setText('[data-summary-field="fundingProgressPercent"]', formatPercent(summary.fundingProgressPercent))
  setText('[data-summary-field="totalRaised"]', formatCurrency(summary.totalRaised))
  setText('[data-summary-field="totalSPVs"]', formatNumber(summary.totalSPVs ?? summary.totalSpvs))
  setText('[data-summary-field="warnings"]', formatNumber(Array.isArray(summary.warnings) ? summary.warnings.length : 0))
  setText('[data-summary-field="latestUpdatedAt"]', formatDate(summary.latestUpdatedAt ?? summary.lastUpdated))
}

const applyOverviewCards = (
  summary: Record<string, unknown> | null,
  context: {
    connectedDatasets: number
    warningCount: number
    endpointConfigured: boolean
  }
) => {
  if (dashboardCards.length === 0) {
    return
  }

  const totalOpportunities = Number(summary?.totalDeals ?? summary?.activeDeals ?? 0)
  const totalDealsSubmitted = Number(summary?.totalOrders ?? summary?.totalParticipation ?? 0)
  const fundingRequests = Number(summary?.totalSPVs ?? summary?.totalSpvs ?? 0)
  const activeParticipants = Number(summary?.totalInvestors ?? 0)
  const totalDocuments = Number(summary?.totalDocuments ?? summary?.sentMailDeals ?? 0)
  const adminControls = context.endpointConfigured ? 100 : 0

  setCardContent('opportunities', formatNumber(totalOpportunities))
  setCardContent('deals-submitted', formatNumber(totalDealsSubmitted))
  setCardContent('funding-requests', formatNumber(fundingRequests))
  setCardContent('participants', formatNumber(activeParticipants))
  setCardContent('documents', formatNumber(totalDocuments))
  setCardContent('admin-controls', formatNumber(adminControls))
}

const bootDashboard = async () => {
  if (!shell) {
    return
  }

  const NEXT_PUBLIC_AZURE_FUNCTION_ENDPOINT = shell.dataset.azureEndpoint || ''
  const NEXT_PUBLIC_ENFORCEMENT_ENGINE_ENDPOINT = shell.dataset.enforcementEndpoint || ''

  if (NEXT_PUBLIC_AZURE_FUNCTION_ENDPOINT) {
    console.info('Dashboard system connection configured')
  } else {
    console.warn('Dashboard system connection not configured')
  }

  if (NEXT_PUBLIC_ENFORCEMENT_ENGINE_ENDPOINT) {
    console.info('Platform submission connection configured')
  } else {
    console.warn('Platform submission connection not configured')
  }

  initializeAdminBuilder(NEXT_PUBLIC_ENFORCEMENT_ENGINE_ENDPOINT, NEXT_PUBLIC_AZURE_FUNCTION_ENDPOINT)
  await loadDashboardData(NEXT_PUBLIC_AZURE_FUNCTION_ENDPOINT, NEXT_PUBLIC_ENFORCEMENT_ENGINE_ENDPOINT)
}

void bootDashboard()
