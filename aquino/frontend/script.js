/* ============================================================
   AQUINO PHARMACY MANAGEMENT SYSTEM — SCRIPT
   Connects directly to Strapi backend at http://localhost:1337
   ============================================================ */

const API_BASE = "http://localhost:1337/api";
const API_TOKEN =
  "2ebadaae4c6aca041268b4b1b6c0ac81b73cc50fc637cb18df9cba6d082c90902d4e0e516b30ba0c389995ed28caec58c93a575fb9946bfc4d15f186a99973cf040817e42f8effe0749f97c93a37a3c4c616edbc3721525f1c0dc288fed7b0ad2136a1937592c9a47336dd077cfb496789b1e7224b53e2647be43555aecfec61"; // 👈 paste your Strapi API token here

// ── API HELPER ─────────────────────────────────────────────
function apiFetch(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_TOKEN}`,
  };
  return fetch(url, { ...options, headers });
}

// ── UID GENERATOR ──────────────────────────────────────────
function generateUID(prefix = "id") {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 7).toUpperCase();
  const pfx = prefix.replace(/ID$/i, "").substring(0, 3).toUpperCase();
  return `${pfx}-${ts}-${rnd}`;
}

// ── STATE ──────────────────────────────────────────────────
let currentSection = "medicines";
let currentPage = 1;
const PAGE_SIZE = 10;
let allRecords = [];
let filteredRecords = [];
let editingId = null;
let pendingDeleteId = null;
let pendingDeleteEndpoint = null;
let searchQuery = "";

// ── SECTION CONFIG ─────────────────────────────────────────
const SECTIONS = {
  medicines: {
    title: "Medicines",
    breadcrumb: "Catalog › Medicines",
    endpoint: "medicines",
    columns: [
      "MedicineID",
      "BrandName",
      "GenericName",
      "DosageForm",
      "Manufacturer",
      "Strength",
      "Category",
    ],
    headers: [
      "Medicine ID",
      "Brand Name",
      "Generic Name",
      "Dosage Form",
      "Manufacturer",
      "Strength",
      "Category",
    ],
    statsIcon: "💊",
    statsLabel: "Total Medicines",
  },
  categories: {
    title: "Medicine Categories",
    breadcrumb: "Catalog › Categories",
    endpoint: "medicine-categories",
    columns: [
      "CategoryName",
      "Description",
      "RequirePrescription",
      "ControlledSubstance",
    ],
    headers: ["Category Name", "Description", "Requires Rx", "Controlled"],
    statsIcon: "🏷",
    statsLabel: "Total Categories",
  },
  suppliers: {
    title: "Suppliers",
    breadcrumb: "Supply Chain › Suppliers",
    endpoint: "suppliers",
    columns: [
      "SupplierID",
      "SupplierName",
      "ContactPerson",
      "PhoneNumber",
      "EmailAddress",
      "LicenseNumber",
    ],
    headers: [
      "Supplier ID",
      "Supplier Name",
      "Contact Person",
      "Phone",
      "Email",
      "License #",
    ],
    statsIcon: "🏭",
    statsLabel: "Total Suppliers",
  },
  "purchase-orders": {
    title: "Purchase Orders",
    breadcrumb: "Supply Chain › Purchase Orders",
    endpoint: "purchase-orders",
    columns: [
      "OrderID",
      "OrderDate",
      "TotalAmount",
      "PaymentStatus",
      "ReceivedDate",
      "Supplier",
    ],
    headers: [
      "Order ID",
      "Order Date",
      "Total Amount",
      "Payment Status",
      "Received Date",
      "Supplier",
    ],
    statsIcon: "📋",
    statsLabel: "Total Orders",
  },
  "order-lines": {
    title: "Purchase Order Lines",
    breadcrumb: "Supply Chain › Order Lines",
    endpoint: "purchase-order-lines",
    columns: [
      "OrderLineID",
      "QuantityOrdered",
      "UnitPriceOrder",
      "LineTotal",
      "ReceivedStatus",
      "OrderRef",
      "MedicineRef",
    ],
    headers: [
      "Line ID",
      "Qty Ordered",
      "Unit Price",
      "Line Total",
      "Status",
      "Purchase Order",
      "Medicine",
    ],
    statsIcon: "📑",
    statsLabel: "Total Order Lines",
  },
  stock: {
    title: "Stock Inventory",
    breadcrumb: "Inventory › Stock",
    endpoint: "stock-inventories",
    columns: [
      "InventoryID",
      "BatchNumber",
      "QuantityOnHand",
      "ExpiryDate",
      "StorageLocation",
      "LastRestockDate",
      "MedicineRef",
    ],
    headers: [
      "Inventory ID",
      "Batch #",
      "Qty On Hand",
      "Expiry Date",
      "Location",
      "Last Restock",
      "Medicine",
    ],
    statsIcon: "📦",
    statsLabel: "Total Stock Records",
  },
};

// ── INIT ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  checkConnection();
  showSection("medicines");
});

// ── CONNECTION CHECK ───────────────────────────────────────
async function checkConnection() {
  try {
    const res = await apiFetch(`${API_BASE}/medicines?pagination[pageSize]=1`);
    setStatus(res.ok);
  } catch {
    setStatus(false);
  }
}

function setStatus(ok) {
  document.getElementById("statusDot").className =
    "status-dot " + (ok ? "ok" : "err");
  document.getElementById("statusText").textContent = ok
    ? "Connected"
    : "Offline";
}

// ── NAVIGATION ─────────────────────────────────────────────
function showSection(section) {
  currentSection = section;
  currentPage = 1;
  searchQuery = "";
  editingId = null;
  document.getElementById("searchInput").value = "";
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) =>
      b.classList.toggle("active", b.dataset.section === section),
    );
  const cfg = SECTIONS[section];
  document.getElementById("pageTitle").textContent = cfg.title;
  document.getElementById("breadcrumb").textContent = cfg.breadcrumb;
  loadData();
}

// ── DATA LOADING ───────────────────────────────────────────
async function loadData() {
  showLoading();
  const cfg = SECTIONS[currentSection];
  const url = `${API_BASE}/${cfg.endpoint}?pagination[pageSize]=200&populate=*`;
  try {
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    allRecords = json.data || [];
    applyFilter();
    renderStatsBar();
    setStatus(true);
  } catch (err) {
    showError(err.message);
    setStatus(false);
  }
}

function applyFilter() {
  if (!searchQuery) {
    filteredRecords = [...allRecords];
  } else {
    const q = searchQuery.toLowerCase();
    filteredRecords = allRecords.filter((r) => {
      const a = r.attributes || r;
      return Object.values(a).some((v) => String(v).toLowerCase().includes(q));
    });
  }
  currentPage = 1;
  renderTable();
  renderPagination();
}

// ── SEARCH ─────────────────────────────────────────────────
let searchTimer;
function handleSearch(val) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = val.trim();
    applyFilter();
  }, 250);
}

// ── STATS BAR ──────────────────────────────────────────────
function renderStatsBar() {
  const cfg = SECTIONS[currentSection];
  const bar = document.getElementById("statsBar");
  let extra = "";
  if (currentSection === "stock") {
    const lowStock = allRecords.filter((r) => {
      const qty = r.attributes?.QuantityOnHand ?? r.QuantityOnHand ?? 0;
      return qty < 10;
    }).length;
    const expiring = allRecords.filter((r) => {
      const d = r.attributes?.ExpiryDate ?? r.ExpiryDate;
      return d && new Date(d) < new Date(Date.now() + 30 * 86400000);
    }).length;
    extra = `
      <div class="stat-card"><div class="stat-icon">⚠️</div>
        <div><div class="stat-value">${lowStock}</div><div class="stat-label">Low Stock</div></div></div>
      <div class="stat-card"><div class="stat-icon">🗓</div>
        <div><div class="stat-value">${expiring}</div><div class="stat-label">Expiring Soon</div></div></div>`;
  }
  bar.innerHTML = `
    <div class="stat-card"><div class="stat-icon">${cfg.statsIcon}</div>
      <div><div class="stat-value">${allRecords.length}</div><div class="stat-label">${cfg.statsLabel}</div></div></div>
    ${extra}`;
}

// ── TABLE RENDER ───────────────────────────────────────────
function renderTable() {
  const cfg = SECTIONS[currentSection];
  const container = document.getElementById("tableContainer");

  if (filteredRecords.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">${cfg.statsIcon}</div>
      <p>No records found${searchQuery ? ' for "' + searchQuery + '"' : ""}.</p></div>`;
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filteredRecords.slice(start, start + PAGE_SIZE);
  const ths =
    cfg.headers.map((h) => `<th>${h}</th>`).join("") + "<th>Actions</th>";
  const rows = page
    .map((record) => {
      const attrs = record.attributes || record;
      const id = record.id;
      const docId = record.documentId || id; // v5 uses documentId
      const cells = cfg.columns.map((col) => renderCell(col, attrs)).join("");
      return `<tr>
  ${cells}
  <td><div class="actions-cell">
    <button class="btn-icon edit" title="Edit"   onclick="openEditModal('${docId}')">✎</button>
    <button class="btn-icon del"  title="Delete" onclick="confirmDelete('${docId}', '${cfg.endpoint}')">✕</button>
  </div></td></tr>`;
    })
    .join("");

  container.innerHTML = `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderCell(col, attrs) {
  // Virtual relation columns
  // WITH:
  if (col === "Category") {
    const rel = attrs.medicine_categorie;
    const name =
      rel?.data?.attributes?.CategoryName ?? // v4 nested
      rel?.attributes?.CategoryName ?? // v5 nested
      rel?.CategoryName ?? // v5 flat
      "—";
    return `<td><span class="badge badge-blue">${name}</span></td>`;
  }

  // WITH:
  if (col === "Supplier") {
    const rel = attrs.supplier;
    const name =
      rel?.data?.attributes?.SupplierName ??
      rel?.attributes?.SupplierName ??
      rel?.SupplierName ??
      "—";
    return `<td><span class="badge badge-blue">${name}</span></td>`;
  }
  if (col === "OrderRef") {
    const rel = attrs.purchase_order;
    const oid =
      rel?.data?.attributes?.OrderID ??
      rel?.attributes?.OrderID ??
      rel?.OrderID ??
      rel?.data?.id ??
      rel?.id ??
      "—";
    return `<td><span class="cell-id" title="${oid}">${oid}</span></td>`;
  }
  if (col === "MedicineRef") {
    const rel = attrs.medicine;
    const name =
      rel?.data?.attributes?.BrandName ??
      rel?.attributes?.BrandName ??
      rel?.BrandName ??
      "—";
    return `<td><span class="badge badge-blue">${name}</span></td>`;
  }

  const val = attrs[col];
  if (val === null || val === undefined)
    return `<td><span style="color:var(--text3)">—</span></td>`;

  if (typeof val === "boolean")
    return `<td><span class="badge ${val ? "badge-green" : "badge-gray"}">${val ? "Yes" : "No"}</span></td>`;

  if (col === "PaymentStatus") {
    const map = {
      paid: "badge-green",
      pending: "badge-amber",
      overdue: "badge-red",
      partial: "badge-blue",
    };
    return `<td><span class="badge ${map[String(val).toLowerCase()] || "badge-gray"}">${val}</span></td>`;
  }
  if (col === "ReceivedStatus") {
    const map = {
      received: "badge-green",
      pending: "badge-amber",
      partial: "badge-blue",
      cancelled: "badge-red",
    };
    return `<td><span class="badge ${map[String(val).toLowerCase()] || "badge-gray"}">${val}</span></td>`;
  }

  if (col.endsWith("ID"))
    return `<td><span class="cell-id" title="${val}">${val}</span></td>`;

  if (col.includes("Date") || col.includes("Restock")) {
    const d = new Date(val).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    return `<td class="cell-mono">${d}</td>`;
  }

  if (["TotalAmount", "UnitPriceOrder", "LineTotal"].includes(col))
    return `<td class="cell-mono">₱ ${Number(val).toLocaleString()}</td>`;

  const str = String(val);
  return str.length > 40
    ? `<td title="${str.replace(/"/g, "&quot;")}">${str.substring(0, 38)}…</td>`
    : `<td>${str}</td>`;
}

// ── PAGINATION ─────────────────────────────────────────────
function renderPagination() {
  const container = document.getElementById("pagination");
  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE);
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, filteredRecords.length);
  const range = 2;
  let btns = "";

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - range && i <= currentPage + range)
    ) {
      btns += `<button class="page-btn ${i === currentPage ? "active" : ""}" onclick="goPage(${i})">${i}</button>`;
    } else if (i === currentPage - range - 1 || i === currentPage + range + 1) {
      btns += `<button class="page-btn" disabled>…</button>`;
    }
  }

  container.innerHTML = `
    <span class="page-info">Showing ${start}–${end} of ${filteredRecords.length}</span>
    <div class="page-btns">
      <button class="page-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""}>‹</button>
      ${btns}
      <button class="page-btn" onclick="goPage(${currentPage + 1})" ${currentPage === totalPages ? "disabled" : ""}>›</button>
    </div>`;
}

function goPage(p) {
  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE);
  if (p < 1 || p > totalPages) return;
  currentPage = p;
  renderTable();
  renderPagination();
}

// ── LOADING / ERROR STATES ─────────────────────────────────
function showLoading() {
  document.getElementById("tableContainer").innerHTML =
    `<div class="loading-state"><div class="spinner"></div><p>Loading data…</p></div>`;
  document.getElementById("pagination").innerHTML = "";
  document.getElementById("statsBar").innerHTML = "";
}

function showError(msg) {
  document.getElementById("tableContainer").innerHTML =
    `<div class="error-state">
      <p>⚠ Error: ${msg}</p>
      <p style="font-size:12px;color:var(--text3)">Make sure Strapi is running at localhost:1337 and your API token is valid.</p>
    </div>`;
}

// ── MODAL: ADD ─────────────────────────────────────────────
function openAddModal() {
  editingId = null;
  const label = SECTIONS[currentSection].title
    .replace(/ies$/, "y")
    .replace(/s$/, "");
  document.getElementById("modalTitle").textContent = "Add " + label;
  document.getElementById("modalBody").innerHTML = buildForm(
    currentSection,
    null,
  );
  loadRelationOptions(null);
  document.getElementById("modalOverlay").classList.add("open");
}

// ── MODAL: EDIT ────────────────────────────────────────────
async function openEditModal(id) {
  editingId = id;
  const cfg = SECTIONS[currentSection];
  document.getElementById("modalTitle").textContent = "Edit Record";
  document.getElementById("modalBody").innerHTML =
    `<div class="loading-state"><div class="spinner"></div></div>`;
  document.getElementById("modalOverlay").classList.add("open");

  try {
    const res = await apiFetch(`${API_BASE}/${cfg.endpoint}/${id}?populate=*`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const attrs = json.data?.attributes ?? json.data ?? {};
    document.getElementById("modalBody").innerHTML = buildForm(
      currentSection,
      attrs,
    );
    loadRelationOptions(attrs);
  } catch (err) {
    document.getElementById("modalBody").innerHTML =
      `<p style="color:var(--red)">Error loading record: ${err.message}</p>`;
  }
}

// ── FORM BUILDER ───────────────────────────────────────────
function buildForm(section, data) {
  const d = data || {};

  const inp = (name, label, type = "text", required = false, val = "") =>
    `<div class="form-group">
      <label>${label}</label>
      <input class="form-input" name="${name}" type="${type}"
        value="${escHtml(String(val ?? ""))}" ${required ? "required" : ""} />
    </div>`;

  const ta = (name, label, required = false, val = "") =>
    `<div class="form-group">
      <label>${label}</label>
      <textarea class="form-textarea" name="${name}"
        ${required ? "required" : ""}>${escHtml(String(val ?? ""))}</textarea>
    </div>`;

  const sel = (name, label, opts, val = "", required = false) =>
    `<div class="form-group">
      <label>${label}</label>
      <select class="form-select" name="${name}" ${required ? "required" : ""}>
        <option value="">— Select —</option>
        ${opts.map((o) => `<option value="${o.value}" ${String(o.value) === String(val) ? "selected" : ""}>${o.label}</option>`).join("")}
      </select>
    </div>`;

  switch (section) {
    case "medicines":
      return `
        <div class="form-grid">
          ${inp("BrandName", "Brand Name *", "text", true, d.BrandName || "")}
          ${inp("GenericName", "Generic Name *", "text", true, d.GenericName || "")}
        </div>
        <div class="form-grid">
          ${inp("DosageForm", "Dosage Form *", "text", true, d.DosageForm || "")}
          ${inp("Strength", "Strength (mg)", "number", false, d.Strength || "")}
        </div>
        ${ta("Manufacturer", "Manufacturer *", true, d.Manufacturer || "")}
        <div class="form-group">
          <label>Medicine Category</label>
          <select class="form-select" name="medicine_categorie" id="rel_catSelect">
            <option value="">— Select Category —</option>
          </select>
        </div>`;

    case "categories":
      return `
        ${inp("CategoryName", "Category Name *", "text", true, d.CategoryName || "")}
        ${ta("Description", "Description *", true, d.Description || "")}
        <div class="form-grid">
          ${inp("ControlledSubstance", "Controlled Substance *", "text", true, d.ControlledSubstance || "")}
          <div class="form-group" style="justify-content:flex-end;padding-top:20px">
            <div class="form-checkbox-row">
              <input type="checkbox" name="RequirePrescription" id="rxCheck"
                ${d.RequirePrescription ? "checked" : ""} />
              <label for="rxCheck">Requires Prescription</label>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>Storage Requirements *</label>
          <textarea class="form-textarea" name="StorageRequirements" required>${escHtml(
            Array.isArray(d.StorageRequirements)
              ? d.StorageRequirements.map((b) =>
                  (b.children || []).map((c) => c.text || "").join(""),
                ).join("\n")
              : d.StorageRequirements || "",
          )}</textarea>
        </div>`;

    case "suppliers":
      return `
        <div class="form-grid">
          ${inp("SupplierName", "Supplier Name *", "text", true, d.SupplierName || "")}
          ${inp("ContactPerson", "Contact Person *", "text", true, d.ContactPerson || "")}
        </div>
        <div class="form-grid">
          ${inp("PhoneNumber", "Contact Number *", "number", true, d.PhoneNumber || "")}
          ${inp("EmailAddress", "Email Address *", "email", true, d.EmailAddress || "")}
        </div>
        ${inp("LicenseNumber", "License Number *", "number", true, d.LicenseNumber || "")}`;

    case "purchase-orders":
      return `
        <div class="form-grid">
          ${inp("OrderDate", "Order Date *", "datetime-local", true, d.OrderDate ? d.OrderDate.slice(0, 16) : "")}
          ${inp("ReceivedDate", "Received Date *", "datetime-local", true, d.ReceivedDate ? d.ReceivedDate.slice(0, 16) : "")}
        </div>
        <div class="form-grid">
          ${inp("TotalAmount", "Total Amount (₱) *", "number", true, d.TotalAmount || "")}
          ${sel(
            "PaymentStatus",
            "Payment Status *",
            [
              { value: "Pending", label: "Pending" },
              { value: "Paid", label: "Paid" },
              { value: "Partial", label: "Partial" },
              { value: "Overdue", label: "Overdue" },
            ],
            d.PaymentStatus || "",
            true,
          )}
        </div>
        <div class="form-group">
          <label>Supplier *</label>
          <select class="form-select" name="supplier" id="rel_supplierSelect" required>
            <option value="">— Select Supplier —</option>
          </select>
        </div>`;

    case "order-lines":
      return `
        <div class="form-grid">
          ${inp("QuantityOrdered", "Qty Ordered *", "number", true, d.QuantityOrdered || "")}
          ${inp("UnitPriceOrder", "Unit Price *", "number", true, d.UnitPriceOrder || "")}
        </div>
        <div class="form-grid">
          ${inp("LineTotal", "Line Total *", "number", true, d.LineTotal || "")}
          ${sel(
            "ReceivedStatus",
            "Received Status *",
            [
              { value: "Pending", label: "Pending" },
              { value: "Received", label: "Received" },
              { value: "Partial", label: "Partial" },
              { value: "Cancelled", label: "Cancelled" },
            ],
            d.ReceivedStatus || "",
            true,
          )}
        </div>
        <div class="form-group">
          <label>Purchase Order *</label>
          <select class="form-select" name="purchase_order" id="rel_orderSelect" required>
            <option value="">— Select Purchase Order —</option>
          </select>
        </div>
        <div class="form-group">
          <label>Medicine *</label>
          <select class="form-select" name="medicine" id="rel_medSelect" required>
            <option value="">— Select Medicine —</option>
          </select>
        </div>`;

    case "stock":
      return `
        <div class="form-grid">
          ${inp("BatchNumber", "Batch Number *", "number", true, d.BatchNumber || "")}
          ${inp("QuantityOnHand", "Qty On Hand *", "number", true, d.QuantityOnHand || "")}
        </div>
        <div class="form-grid">
          ${inp("ExpiryDate", "Expiry Date *", "datetime-local", true, d.ExpiryDate ? d.ExpiryDate.slice(0, 16) : "")}
          ${inp("LastRestockDate", "Last Restock Date *", "datetime-local", true, d.LastRestockDate ? d.LastRestockDate.slice(0, 16) : "")}
        </div>
        ${inp("StorageLocation", "Storage Location *", "text", true, d.StorageLocation || "")}
        <div class="form-group">
          <label>Medicine *</label>
          <select class="form-select" name="medicine" id="rel_medSelect2" required>
            <option value="">— Select Medicine —</option>
          </select>
        </div>`;

    default:
      return "<p>Form not defined for this section.</p>";
  }
}

// ── RELATION DROPDOWNS ─────────────────────────────────────
async function loadRelationOptions(data) {
  const d = data || {};

  async function populate(selectId, endpoint, labelFn, currentId) {
    const el = document.getElementById(selectId);
    if (!el) {
      console.warn(`Dropdown #${selectId} not found in DOM`);
      return;
    }
    try {
      const res = await apiFetch(
        `${API_BASE}/${endpoint}?pagination[pageSize]=200&populate=*`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items = json.data || [];

      if (items.length === 0) {
        console.warn(`No data returned from /${endpoint}`);
      }

      items.forEach((item) => {
        const attrs = item.attributes ?? item;
        const opt = document.createElement("option");
        opt.value = item.id; // numeric id used for connect
        opt.textContent = labelFn(attrs, item.id);
        const matchId = item.documentId || item.id;
        if (
          String(matchId) === String(currentId) ||
          String(item.id) === String(currentId)
        ) {
          opt.selected = true;
        }
        el.appendChild(opt);
      });
    } catch (e) {
      console.error(`Failed to populate #${selectId} from /${endpoint}:`, e);
    }
  }

  if (currentSection === "medicines") {
    const currentCatId =
      d.medicine_categorie?.data?.id ?? d.medicine_categorie?.id ?? null;
    const currentSuppId = d.supplier?.data?.id ?? d.supplier?.id ?? null;
    const currentOrderId =
      d.purchase_order?.data?.id ?? d.purchase_order?.id ?? null;
    const currentMedId = d.medicine?.data?.id ?? d.medicine?.id ?? null;
    await populate(
      "rel_catSelect",
      "medicine-categories",
      (a) => a.CategoryName || `[ID ${a.id ?? "?"}]`,
      currentCatId,
    );
  }

  if (currentSection === "purchase-orders") {
    const currentSuppId = d.supplier?.data?.id ?? null;
    await populate(
      "rel_supplierSelect",
      "suppliers",
      (a) => a.SupplierName || `[ID ${a.id ?? "?"}]`,
      currentSuppId,
    );
  }

  if (currentSection === "order-lines") {
    const currentOrderId = d.purchase_order?.data?.id ?? null;
    const currentMedId = d.medicine?.data?.id ?? null;
    await populate(
      "rel_orderSelect",
      "purchase-orders",
      (a, id) => {
        const label = a.OrderID || a.orderID || "";
        return `Order #${id}${label ? " — " + label : ""}`;
      },
      currentOrderId,
    );
    await populate(
      "rel_medSelect",
      "medicines",
      (a) => {
        const brand = a.BrandName || "";
        const generic = a.GenericName || "";
        return brand || generic
          ? `${brand}${brand && generic ? " — " : ""}${generic}`
          : `[Medicine ID ${a.id ?? "?"}]`;
      },
      currentMedId,
    );
  }

  if (currentSection === "stock") {
    const currentMedId = d.medicine?.data?.id ?? null;
    await populate(
      "rel_medSelect2",
      "medicines",
      (a) => {
        const brand = a.BrandName || "";
        const generic = a.GenericName || "";
        return brand || generic
          ? `${brand}${brand && generic ? " — " : ""}${generic}`
          : `[Medicine ID ${a.id ?? "?"}]`;
      },
      currentMedId,
    );
  }
}

// ── SAVE RECORD ────────────────────────────────────────────
async function saveRecord() {
  const cfg = SECTIONS[currentSection];
  const body = document.getElementById("modalBody");
  const inputs = body.querySelectorAll("[name]");
  const payload = {};

  // 1. Collect all form values
  inputs.forEach((el) => {
    if (el.type === "checkbox") {
      payload[el.name] = el.checked;
    } else if (el.value.trim() !== "") {
      payload[el.name] = el.value.trim();
    }
  });

  // 2. Convert number fields from string → number
  const intFields = {
    medicines: ["Strength"],
    suppliers: ["PhoneNumber", "LicenseNumber"],
    "purchase-orders": ["TotalAmount"],
    "order-lines": ["QuantityOrdered", "UnitPriceOrder", "LineTotal"],
    stock: ["BatchNumber", "QuantityOnHand"],
  };
  (intFields[currentSection] || []).forEach((f) => {
    if (payload[f] !== undefined) payload[f] = Number(payload[f]);
  });

  // 3. UID fields — generate on CREATE, strip on EDIT
  const uidMap = {
    medicines: ["MedicineID"],
    suppliers: ["SupplierID"],
    "purchase-orders": ["OrderID"],
    "order-lines": ["OrderLineID"],
    stock: ["InventoryID"],
  };
  (uidMap[currentSection] || []).forEach((f) => {
    if (!editingId) {
      payload[f] = generateUID(f);
    } else {
      delete payload[f];
    }
  });

  // 4. StorageRequirements → Strapi rich-text blocks format
  if (currentSection === "categories" && payload.StorageRequirements) {
    payload.StorageRequirements = [
      {
        type: "paragraph",
        children: [{ type: "text", text: payload.StorageRequirements }],
      },
    ];
  }

  // 5. Wrap relation IDs in Strapi connect format
  const relMap = {
    medicines: ["medicine_categorie"],
    "purchase-orders": ["supplier"],
    "order-lines": ["purchase_order", "medicine"],
    stock: ["medicine"],
  };
  (relMap[currentSection] || []).forEach((rel) => {
    if (payload[rel]) {
      // v5: relations connect by documentId (string), not numeric id
      payload[rel] = { connect: [Number(payload[rel])] };
    } else {
      delete payload[rel];
    }
  });

  // 6. Send to Strapi
  const method = editingId ? "PUT" : "POST";
  const url = editingId
    ? `${API_BASE}/${cfg.endpoint}/${editingId}`
    : `${API_BASE}/${cfg.endpoint}`;

  const btn = document.getElementById("modalSaveBtn");
  btn.textContent = "Saving…";
  btn.disabled = true;

  try {
    const res = await apiFetch(url, {
      method,
      body: JSON.stringify({ data: payload }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const detail = errJson.error?.details?.errors
        ?.map((e) => e.message)
        .join(", ");
      throw new Error(detail || errJson.error?.message || `HTTP ${res.status}`);
    }

    closeModalDirect();
    showToast(editingId ? "Record updated!" : "Record created!", "success");
    loadData();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    btn.textContent = "Save";
    btn.disabled = false;
  }
}

// ── DELETE ─────────────────────────────────────────────────
function confirmDelete(id, endpoint) {
  pendingDeleteId = id;
  pendingDeleteEndpoint = endpoint;
  document.getElementById("deleteOverlay").classList.add("open");

  const btn = document.getElementById("confirmDeleteBtn");
  // Clone the button to strip all previously stacked onclick listeners
  const fresh = btn.cloneNode(true);
  btn.parentNode.replaceChild(fresh, btn);
  fresh.textContent = "Delete";
  fresh.disabled = false;
  fresh.onclick = () => deleteRecord(pendingDeleteId, pendingDeleteEndpoint);
}

async function deleteRecord(id, endpoint) {
  const btn = document.getElementById("confirmDeleteBtn");
  btn.textContent = "Deleting…";
  btn.disabled = true;

  try {
    const res = await apiFetch(`${API_BASE}/${endpoint}/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `HTTP ${res.status}`);
    }
    closeDeleteDirect();
    showToast("Record deleted!", "success");
    loadData();
  } catch (err) {
    showToast("Error: " + err.message, "error");
    btn.textContent = "Delete";
    btn.disabled = false;
  }
}

// ── MODAL HELPERS ──────────────────────────────────────────
function closeModal(e) {
  if (e.target === document.getElementById("modalOverlay")) closeModalDirect();
}
function closeModalDirect() {
  document.getElementById("modalOverlay").classList.remove("open");
  editingId = null;
}
function closeDeleteModal(e) {
  if (e.target === document.getElementById("deleteOverlay"))
    closeDeleteDirect();
}
function closeDeleteDirect() {
  document.getElementById("deleteOverlay").classList.remove("open");
  pendingDeleteId = null;
  pendingDeleteEndpoint = null;
}

// ── TOAST ──────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.className = "toast";
  }, 3500);
}

// ── UTILS ──────────────────────────────────────────────────
function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── EXPOSE GLOBALS FOR INLINE onclick HANDLERS ─────────────
window.showSection = showSection;
window.handleSearch = handleSearch;
window.openAddModal = openAddModal;
window.openEditModal = openEditModal;
window.saveRecord = saveRecord;
window.confirmDelete = confirmDelete;
window.deleteRecord = deleteRecord;
window.closeModal = closeModal;
window.closeModalDirect = closeModalDirect;
window.closeDeleteModal = closeDeleteModal;
window.closeDeleteDirect = closeDeleteDirect;
window.goPage = goPage;
