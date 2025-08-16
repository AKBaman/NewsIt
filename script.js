// Switched to The Guardian Open Platform (works in browser)
// Docs: https://open-platform.theguardian.com/
// You can replace 'test' with your own key later.
const API_BASE = "https://content.guardianapis.com/search";
const API_KEY = "45962a75-12bf-4dad-acab-ef49dcfd53db"; // for demos; create your own key for reliability

let currentQuery = "India";
let currentSection = null;
let currentPage = 1;
const pageSize = 12;

/* ---------- Helpers ---------- */
function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  } catch {
    return dateStr;
  }
}

function toDisplayModel(item) {
  // Normalize both Guardian items and saved bookmarks into one shape
  if (item && item.webTitle) {
    return {
      title: item.webTitle,
      desc: item.fields?.trailText || "",
      img: item.fields?.thumbnail || "",
      source: item.sectionName || "The Guardian",
      date: item.webPublicationDate,
      url: item.webUrl,
    };
  } else {
    return {
      title: item.title || "Untitled",
      desc: item.description || "",
      img: item.imageUrl || item.urlToImage || "",
      source: typeof item.source === "string" ? item.source : (item.source?.name || "Saved"),
      date: item.publishedAt || "",
      url: item.url,
    };
  }
}

function reload() {
    window.location.href = "/"; // redirect to home
}

function stripTags(html) {
  const el = document.createElement("div");
  el.innerHTML = html || "";
  return el.textContent || el.innerText || "";
}

/* ---------- Fetch & Bind ---------- */
async function fetchNews({ query = null, section = null, page = 1, append = false } = {}) {
  const params = new URLSearchParams({
    "api-key": API_KEY,
    "page": page,
    "page-size": pageSize,
    "show-fields": "thumbnail,trailText",
    "order-by": "newest",
  });

  if (query) params.set("q", query);
  if (section) params.set("section", section);

  try {
    const res = await fetch(`${API_BASE}?${params.toString()}`);
    const data = await res.json();

    const results = data?.response?.results || [];
    bindData(results, append);
  } catch (err) {
    console.error("Fetch error:", err);
    bindData([], false);
  }
}

function bindData(items, append = false) {
  const cardsContainer = document.getElementById("cards-container");
  const newsCardTemplate = document.getElementById("template-news-card");

  if (!append) cardsContainer.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    cardsContainer.innerHTML = `<p style="padding:12px;">No results found. Try another query.</p>`;
    return;
  }

  items.forEach((item) => {
    const dm = toDisplayModel(item);
    const cardClone = newsCardTemplate.content.cloneNode(true);
    fillDataInCard(cardClone, dm, false);
    cardsContainer.appendChild(cardClone);
  });
}

function fillDataInCard(cardClone, dm, isBookmark = false) {
  const newsImg = cardClone.querySelector("#news-img");
  const newsTitle = cardClone.querySelector("#news-title");
  const newsSource = cardClone.querySelector("#news-source");
  const newsDesc = cardClone.querySelector("#news-desc");
  const bookmarkBtn = cardClone.querySelector(".bookmark-btn");
  const removeBtn = cardClone.querySelector(".remove-btn");

  newsImg.src = dm.img || "https://via.placeholder.com/400x200?text=No+Image";
  newsTitle.textContent = dm.title;
  // Guardian trailText may contain basic HTML; we allow it for formatting.
  newsDesc.innerHTML = dm.desc;
  newsSource.textContent = `${dm.source} · ${formatDate(dm.date)}`;

  // Open in new tab on click
  cardClone.firstElementChild.addEventListener("click", () => {
    if (dm.url) window.open(dm.url, "_blank");
  });

  if (isBookmark) {
    bookmarkBtn.style.display = "none";
    removeBtn.style.display = "inline-block";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeBookmark(dm.url);
    });
  } else {
    removeBtn.style.display = "none";
    bookmarkBtn.style.display = "inline-block";
    bookmarkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      saveBookmark(dm);
    });
  }
}

/* ---------- Nav logic ---------- */
let curSelectedNav = null;

function onNavItemClick(id) {
  // Show main feed and Load More; hide bookmarks section
  const cardsContainer = document.getElementById("cards-container");
  const loadMoreBtn = document.getElementById("load-more");
  if (cardsContainer) cardsContainer.style.display = "flex";
  if (loadMoreBtn) loadMoreBtn.style.display = "inline-block";
  document.getElementById("bookmarks-section").style.display = "none";

  currentPage = 1;
  currentSection = null;
  currentQuery = null;

  // Map your nav IDs to Guardian query/section
  switch (id) {
    case "ipl":
      currentSection = "sport";
      currentQuery = "cricket";
      break;
    case "finance":
      currentSection = "business";
      currentQuery = "finance";
      break;
    case "politics":
      currentSection = "politics";
      break;
    case "technology":
      currentSection = "technology";
      break;
    case "travel":
      currentSection = "travel";
      break;
    case "innovation":
      currentSection = "technology";
      currentQuery = "innovation";
      break;
    default:
      currentQuery = "India";
  }

  fetchNews({ query: currentQuery, section: currentSection, page: currentPage, append: false });

  const navItem = document.getElementById(id);
  curSelectedNav?.classList.remove("active");
  curSelectedNav = navItem;
  curSelectedNav.classList.add("active");
}

/* ---------- Search ---------- */
const searchButton = document.getElementById("search-button");
const searchText = document.getElementById("search-text");

searchButton.addEventListener("click", () => {
  const query = (searchText.value || "").trim();
  if (!query) return;
  currentPage = 1;
  currentSection = null;
  currentQuery = query;
  fetchNews({ query: currentQuery, section: null, page: currentPage, append: false });
  curSelectedNav?.classList.remove("active");
  curSelectedNav = null;
});

searchText.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    searchButton.click();
  }
});

/* ---------- Load More ---------- */
document.getElementById("load-more").addEventListener("click", () => {
  currentPage++;
  fetchNews({ query: currentQuery, section: currentSection, page: currentPage, append: true });
});

/* ---------- Bookmarks ---------- */
function dedupByUrl(arr) {
  const seen = new Set();
  return arr.filter((x) => {
    if (!x.url || seen.has(x.url)) return false;
    seen.add(x.url);
    return true;
  });
}

function getBookmarks() {
  // migrate old key if needed
  let v2 = JSON.parse(localStorage.getItem("bookmarks_v2")) || [];
  const legacy = JSON.parse(localStorage.getItem("bookmarks")) || [];
  if (legacy.length && !localStorage.getItem("migratedBookmarks")) {
    legacy.forEach((a) => {
      const dm = toDisplayModel(a);
      v2.push({
        title: dm.title,
        description: stripTags(dm.desc),
        imageUrl: dm.img,
        url: dm.url,
        publishedAt: dm.date,
        source: dm.source,
      });
    });
    v2 = dedupByUrl(v2);
    localStorage.setItem("bookmarks_v2", JSON.stringify(v2));
    localStorage.setItem("migratedBookmarks", "true");
  }
  return v2;
}

function saveBookmark(dm) {
  let bookmarks = getBookmarks();
  if (!bookmarks.some((b) => b.url === dm.url)) {
    bookmarks.push({
      title: dm.title,
      description: stripTags(dm.desc),
      imageUrl: dm.img,
      url: dm.url,
      publishedAt: dm.date,
      source: dm.source,
    });
    localStorage.setItem("bookmarks_v2", JSON.stringify(bookmarks));
    loadBookmarks();
  }
}

function loadBookmarks() {
  const container = document.getElementById("bookmarks-container");
  const template = document.getElementById("template-news-card");
  container.innerHTML = "";

  const bookmarks = getBookmarks();
  bookmarks.forEach((b) => {
    const dm = toDisplayModel(b);
    const cardClone = template.content.cloneNode(true);
    fillDataInCard(cardClone, dm, true); // render with remove button
    container.appendChild(cardClone);
  });
}

function removeBookmark(articleUrl) {
  let bookmarks = getBookmarks();
  bookmarks = bookmarks.filter((a) => a.url !== articleUrl);
  localStorage.setItem("bookmarks_v2", JSON.stringify(bookmarks));
  loadBookmarks();
}

function showBookmarks() {
  const cardsContainer = document.getElementById("cards-container");
  const loadMoreBtn = document.getElementById("load-more");

  if (cardsContainer) cardsContainer.style.display = "none";
  if (loadMoreBtn) loadMoreBtn.style.display = "none";

  document.getElementById("bookmarks-section").style.display = "block";

  curSelectedNav?.classList.remove("active");
  curSelectedNav = document.getElementById("bookmarks-tab");
  curSelectedNav.classList.add("active");

  loadBookmarks();
}

/* ---------- Go Up Button ---------- */
const goUpBtn = document.getElementById("go-up");
window.addEventListener("scroll", () => {
  goUpBtn.style.display = window.scrollY > 200 ? "block" : "none";
});
goUpBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ---------- Dark Mode ---------- */
const darkToggle = document.getElementById("dark-toggle");
darkToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
  darkToggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
});

/* ---------- Initial Load ---------- */
window.addEventListener("load", () => {
  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
    darkToggle.textContent = "☀️";
  }
  // default: India query
  fetchNews({ query: currentQuery, section: currentSection, page: currentPage, append: false });
});
