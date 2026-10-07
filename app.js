import { isBundleProduct, priceCart } from "./bundle-pricing.js?v=20261004-manual";
import { photoSource, categoryOf, cartProduct, reconcileCart } from "./shop-utils.js?v=20261004-manual";
import { generatedPhotoFor } from "./product-photos.js?v=20261003";
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  firebaseConfig
} from "./firebase-config.js";


const WORKER_URL =
  "https://yingjie-line-login.twm0987373440.workers.dev";


/* =========================
   Firebase
========================= */

const configured =
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith("YOUR_");


const db =
  configured
    ? getFirestore(
        initializeApp(firebaseConfig)
      )
    : null;


/* =========================
   示範商品
========================= */

const demo = [

  ["高麗菜", "斤", 35, "🥬"],
  ["青江菜", "把", 30, "🥬"],
  ["空心菜", "把", 25, "🌿"],
  ["小白菜", "把", 25, "🥬"],
  ["菠菜", "把", 35, "🌿"],
  ["青椒", "斤", 55, "🫑"],
  ["洋蔥", "斤", 30, "🧅"],
  ["紅蘿蔔", "斤", 35, "🥕"],
  ["馬鈴薯", "斤", 40, "🥔"],
  ["白蘿蔔", "條", 30, "🥕"]

].map(
  (item, index) => ({

    id:
      "d" + index,

    name:
      item[0],

    unit:
      item[1],

    price:
      item[2],

    emoji:
      item[3],

    active:
      true,

    sort:
      index

  })
);


/* =========================
   資料
========================= */

let products = [];


let cart = {};
try { cart = JSON.parse(localStorage.getItem("yjcart") || "{}"); if(!cart || Array.isArray(cart) || typeof cart !== "object") cart = {}; } catch { cart = {}; }
let currentPage = "home";
let activeCategory = "all";
let productsReady = false;
function saveCart() { try { localStorage.setItem("yjcart", JSON.stringify(cart)); } catch { /* Cart remains usable if storage is full or disabled. */ } }



let member = null;


/* =========================
   共用工具
========================= */

const $ =
  id =>
    document.getElementById(id);


const money =
  n =>
    "NT$" +
    Number(n || 0)
      .toLocaleString("zh-TW");


const esc =
  s =>
    String(s ?? "")
      .replace(
        /[&<>"']/g,
        c => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[c])
      );


/* =========================
   底部四頁
========================= */

function showPage(pageName) {
  currentPage = pageName;
  if(pageName === "member" && member) loadMemberOrders();
  if($("quickCart")) $("quickCart").hidden = pageName !== "home" || !Object.keys(cart).length;

  const pages = [
    "home",
    "cart",
    "member",
    "store"
  ];


  pages.forEach(name => {

    const page =
      $(`page-${name}`);


    if (!page) {
      return;
    }


    if (name === pageName) {

      page.hidden =
        false;


      page.classList.add(
        "active"
      );


    } else {

      page.hidden =
        true;


      page.classList.remove(
        "active"
      );

    }

  });


  document
    .querySelectorAll(
      ".bottom-nav-item"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page ===
          pageName
      );

    });


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


function initNavigation() {

  document
    .querySelectorAll(
      "[data-page]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const page =
            button.dataset.page;


          if (page) {

            showPage(page);

          }

        }
      );

    });

}


/* =========================
   店家資訊
========================= */

async function loadStoreSettings() {

  if (!db) {
    return;
  }


  try {

    const snapshot =
      await getDoc(
        doc(
          db,
          "settings",
          "store"
        )
      );


    if (!snapshot.exists()) {

      console.log(
        "尚未建立店家資訊"
      );

      return;

    }


    const data =
      snapshot.data();


    /* 頂部店名 */

    if (
      $("headerStoreName") &&
      data.storeName
    ) {

      $("headerStoreName")
        .textContent =
          data.storeName;

    }


    /* 首頁店名 */

    if (
      $("homeStoreName") &&
      data.storeName
    ) {

      $("homeStoreName")
        .textContent =
          data.storeName;

    }


    /* 首頁介紹 */

    if (
      $("homeIntro") &&
      data.homeIntro
    ) {

      $("homeIntro")
        .textContent =
          data.homeIntro;

    }


    /* 首頁公告 */

    if (
      $("homeAnnouncement")
    ) {

      $("homeAnnouncement")
        .textContent =
          data.announcement ||
          "歡迎光臨";

    }


    /* 店家資訊－店名 */

    if (
      $("infoStoreName")
    ) {

      $("infoStoreName")
        .textContent =
          data.storeName ||
          "英姐蔬果商行";

    }


    /* 地址 */

    if (
      $("infoAddress")
    ) {

      $("infoAddress")
        .textContent =
          data.address ||
          "尚未設定";

    }


    /* 電話 */

    if (
      $("infoPhone")
    ) {

      $("infoPhone")
        .textContent =
          data.phone ||
          "尚未設定";

    }


    /* 營業時間 */

    if (
      $("infoHours")
    ) {

      $("infoHours")
        .textContent =
          data.hours ||
          "尚未設定";

    }


    /* 店家說明 */

    if (
      $("infoDescription")
    ) {

      $("infoDescription")
        .textContent =
          data.description ||
          "每日提供新鮮蔬果，歡迎選購。";

    }


    /* 網頁標題 */

    if (data.storeName) {

      document.title =
        data.storeName +
        "｜每日蔬菜訂購";

    }


    console.log(
      "店家資訊讀取成功",
      data
    );


  } catch (error) {

    console.error(
      "店家資訊讀取失敗：",
      error
    );

  }

}


/* =========================
   LINE 會員
========================= */

async function initMember() {

  const hash =
    window.location.hash;


  if (
    hash.startsWith(
      "#member_token="
    )
  ) {

    const token =
      decodeURIComponent(
        hash.substring(
          "#member_token=".length
        )
      );


    if (token) {

      localStorage.setItem(
        "yj_member_token",
        token
      );

    }


    history.replaceState(
      null,
      "",
      window.location.pathname +
      window.location.search
    );

  }


  const token =
    localStorage.getItem(
      "yj_member_token"
    );


  if (!token) {

    showLoggedOut();

    return;

  }


  try {

    const response =
      await fetch(
        `${WORKER_URL}/verify`,
        {

          method:
            "GET",

          headers: {

            Authorization:
              `Bearer ${token}`

          }

        }
      );


    if (!response.ok) {

      localStorage.removeItem(
        "yj_member_token"
      );


      showLoggedOut();

      return;

    }


    const data =
      await response.json();


    if (
      !data.ok ||
      !data.member
    ) {

      localStorage.removeItem(
        "yj_member_token"
      );


      showLoggedOut();

      return;

    }


    member =
      data.member;


    showLoggedIn(
      member
    );

    if(hash.startsWith("#member_token=")) showPage("member");


  } catch (error) {

    console.error(
      "會員驗證失敗：",
      error
    );


    showLoggedOut();

  }

}


function showLoggedOut() {
  memberOrdersGeneration++;
  memberOrders = [];
  $("refreshMemberOrders").disabled = false;
  $("moreMemberOrders").hidden = true;
  $("memberOrdersList").replaceChildren();
  $("memberOrdersMessage").textContent = "";

  member = null;


  if ($("memberLoggedOut")) {

    $("memberLoggedOut").hidden =
      false;

  }


  if ($("memberLoggedIn")) {

    $("memberLoggedIn").hidden =
      true;

  }

}


function showLoggedIn(data) {
  if(currentPage === "member") loadMemberOrders();

  if ($("memberLoggedOut")) {

    $("memberLoggedOut").hidden =
      true;

  }


  if ($("memberLoggedIn")) {

    $("memberLoggedIn").hidden =
      false;

  }


  if ($("memberName")) {

    $("memberName")
      .textContent =
        `${data.name}，您好`;

  }


  if ($("memberPicture")) {

    if (data.picture) {

      $("memberPicture").src =
        data.picture;


      $("memberPicture")
        .style.display =
          "block";


    } else {

      $("memberPicture")
        .style.display =
          "none";

    }

  }


  if (
    $("name") &&
    !$("name")
      .value
      .trim()
  ) {

    $("name").value =
      data.name ||
      "";

  }

}


if ($("memberLogout")) {

  $("memberLogout")
    .addEventListener(
      "click",
      () => {

        localStorage.removeItem(
          "yj_member_token"
        );


        member = null;


        showLoggedOut();

      }
    );

}


/* =========================
   商品
========================= */


let memberOrders = [], memberOrderFilter = "all", memberOrdersShown = 10, memberOrdersGeneration = 0;
const memberStatus = {new:["訂單已收到","店家將為您確認與準備商品。"],preparing:["備貨中","店家正在準備您的商品。"],ready:["可取貨","商品已備妥，請與店家確認取貨。"],completed:["已完成","感謝您的訂購！"],cancelled:["已取消","如有疑問，請聯絡英姐商行。"]};
async function loadMemberOrders() {
  if(!member) return;
  const generation = ++memberOrdersGeneration;
  const token = localStorage.getItem("yj_member_token");
  $("memberOrdersMessage").textContent = "正在查詢您的訂單…";
  $("refreshMemberOrders").disabled = true;
  try {
    const response = await fetch(WORKER_URL + "/member/orders", {headers:{Authorization:"Bearer " + token},signal:AbortSignal.timeout(20000),cache:"no-store"});
    const result = await response.json();
    if(generation !== memberOrdersGeneration) return;
    if(response.status === 401) {localStorage.removeItem("yj_member_token");showLoggedOut();alert("登入已到期，請重新使用 LINE 登入後查詢訂單。");return;}
    if(!response.ok || !result.ok || !Array.isArray(result.orders)) throw Error(result.error || "訂單暫時無法載入，請重新查詢。");
    memberOrders = result.orders; memberOrdersShown = 10;
    renderMemberOrders();
  } catch(error) {
    if(generation !== memberOrdersGeneration) return;
    memberOrders = []; $("memberOrdersList").replaceChildren(); $("moreMemberOrders").hidden = true;
    $("memberOrdersMessage").textContent = error.name === "TimeoutError" || error.name === "TypeError" ? "連線暫時中斷，請按「重新查詢」，或聯絡英姐商行。" : error.message;
  } finally {if(generation === memberOrdersGeneration) $("refreshMemberOrders").disabled = false;}
}
function renderMemberOrders() {
  const selected = memberOrders.filter(o => memberOrderFilter === "all" || (memberOrderFilter === "completed" ? o.status === "completed" : !["completed","cancelled"].includes(o.status)));
  $("memberOrdersMessage").textContent = selected.length ? "共 " + selected.length + " 筆訂單 · 進度以店家更新為準" : (memberOrders.length ? "此分類目前沒有訂單。" : "目前沒有會員訂單，歡迎先到首頁選購。 ");
  $("memberOrdersList").innerHTML = selected.slice(0,memberOrdersShown).map(order => {
    const status = memberStatus[order.status] || ["處理中","請聯絡店家確認最新進度。"];
    const date = new Date(order.createdAt);
    const validDate = !Number.isNaN(date.getTime());
    const day = validDate ? new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Taipei",year:"2-digit",month:"2-digit",day:"2-digit"}).format(date).replaceAll("-","") : "";
    const number = day + "-" + makeOrderSuffix(order.id);
    const time = validDate ? date.toLocaleString("zh-TW",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}) : "時間未記錄";
    const steps = ["new","preparing","ready","completed"], current = steps.indexOf(order.status);
    const progress = current < 0 ? "" : '<ol class="order-progress" aria-label="訂單進度">' + steps.map((step,i)=>'<li class="'+(i<=current?'reached':'')+'" '+(i===current?'aria-current="step"':'')+'>'+({new:"已收到",preparing:"備貨中",ready:"可取貨",completed:"已完成"}[step])+'</li>').join("")+'</ol>';
    return '<article class="member-order-card"><div class="order-card-heading"><b>訂單 '+esc(number)+'</b><span class="order-status">'+status[0]+'</span></div><p class="order-date">'+esc(time)+'</p>'+progress+'<p>'+status[1]+'</p><details><summary>商品明細 · '+money(order.total)+'</summary><ul class="member-order-items">'+(order.items||[]).map(i=>'<li><span>'+esc(i.name)+' × '+esc(i.qty)+' '+esc(i.unit)+'</span><b>'+money(Number(i.price)*Number(i.qty))+'</b></li>').join("")+'</ul>'+(Number(order.discount)>0?'<p>優惠折抵：'+money(order.discount)+'</p>':'')+'<p class="order-total">訂單金額：<b>'+money(order.total)+'</b></p>'+(order.note?'<p class="order-note">備註：'+esc(order.note)+'</p>':'')+'</details></article>';
  }).join("");
  $("moreMemberOrders").hidden = selected.length <= memberOrdersShown;
}
$("refreshMemberOrders").addEventListener("click", loadMemberOrders);
$("moreMemberOrders").addEventListener("click", () => {memberOrdersShown += 10;renderMemberOrders();});
document.querySelectorAll("[data-order-filter]").forEach(button=>button.addEventListener("click",()=>{memberOrderFilter=button.dataset.orderFilter;memberOrdersShown=10;document.querySelectorAll("[data-order-filter]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));renderMemberOrders();}));

async function loadProducts() {

  if (!db) {

    products =
      demo;


    setStatus(
      "目前為示範模式"
    );


    renderProducts();

    return;

  }


  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "products"
        )
      );


    products =
      snapshot.docs
        .map(docItem => ({

          id:
            docItem.id,

          ...docItem.data()

        }))
        .filter(
          product =>
            product.active !==
            false
        )
        .sort(
          (a, b) =>
            (a.sort ?? 999) -
            (b.sort ?? 999)
        );


    productsReady = true;
    cart = reconcileCart(cart, products); saveCart();
    setStatus(
      products.length ? "" : "目前沒有上架商品"
    );


    renderProducts();


  } catch (error) {

    console.error(
      "商品讀取失敗：",
      error
    );


    products = [];
    productsReady = false;

    setStatus(
      "商品暫時無法載入，請重新整理後再試。"
    );


    renderProducts();

  }

}


function setStatus(text) {
  if($("status")) $("status").hidden = !text;

  if ($("status")) {

    $("status")
      .textContent =
        text;

  }

}


/* =========================
   商品畫面
========================= */

function renderProducts() {
  const visible = products.filter(p => activeCategory === "all" || (activeCategory === "bundle" ? isBundleProduct(p) : categoryOf(p) === activeCategory));
  $("productsTitle").textContent = activeCategory === "bundle" ? "3包50元專區" : "今日精選";
  $("productsDescription").textContent = activeCategory === "bundle" ? "專區商品任選混搭，每滿3包50元；其餘每包20元。" : "選擇數量後加入購物車";
  $("products").innerHTML = visible.map(p => {
    const qty = cart[p.id]?.qty || 0;
    const ownPhoto = photoSource(p.photo);
    const photo = ownPhoto || generatedPhotoFor(p.name);
    return `<article class="card">
      <button class="product-photo" type="button" data-photo-id="${esc(p.id)}" aria-label="放大${esc(p.name)}照片" ${photo ? "" : "disabled"}>
        ${photo ? `<img src="${esc(photo)}" alt="${esc(p.name)}" loading="lazy" decoding="async">${!ownPhoto ? '<span class="generated-photo-label">示意圖</span>' : ""}` : `<span class="photo-placeholder"><span>${esc(p.emoji || "🥬")}</span><small>照片準備中</small></span>`}
      </button>
      <div class="product-info"><h3>${esc(p.name)}</h3>${isBundleProduct(p) ? '<span class="bundle-badge">任選3包50元</span>' : ""}<div class="product-bottom"><div class="price">${money(p.price)} <small>/ ${esc(p.unit || "份")}</small></div>
      <div class="qty"><button class="qty-minus" data-id="${esc(p.id)}" type="button" aria-label="減少${esc(p.name)}" ${qty ? "" : "disabled"}>−</button><b>${qty}</b><button class="qty-plus" data-id="${esc(p.id)}" type="button" aria-label="增加${esc(p.name)}">＋</button></div></div></div>
    </article>`;
  }).join("") || (activeCategory === "bundle" ? '<p class="category-empty">專區商品準備中，敬請期待</p>' : '<p class="category-empty">此分類目前沒有商品</p>');
  $("products").querySelectorAll("img").forEach(img => img.addEventListener("error", () => {
    const button = img.closest("button"); button.disabled = true;
    button.innerHTML = '<span class="photo-placeholder"><span>🥬</span><small>照片暫時無法顯示</small></span>';
  }));
  renderCart();
}
$("products").addEventListener("click", event => {
  const step = event.target.closest(".qty-minus,.qty-plus");
  if(step) {
    const selector = step.classList.contains("qty-plus") ? ".qty-plus" : ".qty-minus";
    changeQty(step.dataset.id, selector === ".qty-plus" ? 1 : -1);
    const replacement = [...$("products").querySelectorAll(selector)].find(b => b.dataset.id === step.dataset.id);
    if(replacement && !replacement.disabled) replacement.focus({preventScroll:true});
    return;
  }
  const button = event.target.closest("[data-photo-id]");
  const p = button && products.find(p => p.id === button.dataset.photoId);
  const ownPhoto = p && photoSource(p.photo);
  const photo = ownPhoto || (p && generatedPhotoFor(p.name));
  if(!photo) return;
  $("zoomPhoto").src = photo; $("zoomPhoto").alt = p.name;
  $("zoomCaption").textContent = p.name + (ownPhoto ? "" : "（示意圖）"); $("photoDialog").showModal();
});
$("closePhoto").addEventListener("click", () => $("photoDialog").close());
$("photoDialog").addEventListener("click", e => { if(e.target === $("photoDialog")) $("photoDialog").close(); });
document.querySelectorAll("[data-category]").forEach(b => b.addEventListener("click", () => {
  activeCategory = b.dataset.category;
  document.querySelectorAll("[data-category]").forEach(x => {
    x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b));
  }); renderProducts();
}));


/* =========================
   商品數量
========================= */

function changeQty(
  id,
  change
) {

  const product =
    products.find(
      item =>
        item.id === id
    );


  if (!product) {
    return;
  }


  const currentQty =
    cart[id]?.qty ||
    0;


  const qty =
    Math.max(
      0,
      currentQty +
      change
    );


  if (qty > 0) {

    cart[id] = {

      p:
        cartProduct(product),

      qty

    };


  } else {

    delete cart[id];

  }


  saveCart();


  renderProducts();

}


/* =========================
   購物車
========================= */

function renderCart() {
  cart = reconcileCart(cart, productsReady ? products : null);

  const items =
    Object.values(cart);


  const count =
    items.reduce(
      (sum, item) =>
        sum +
        item.qty,
      0
    );


  if ($("count")) {

    $("count")
      .textContent =
        count +
        " 項";

  }


  if ($("navCartBadge")) {

    if (count > 0) {

      $("navCartBadge")
        .hidden =
          false;


      $("navCartBadge")
        .textContent =
          count > 99
            ? "99+"
            : String(count);


    } else {

      $("navCartBadge")
        .hidden =
          true;

    }

  }


  if ($("cart")) {

    if (!items.length) {

      $("cart").innerHTML = `

        <div class="empty-cart">

          <div class="empty-cart-icon">
            🛒
          </div>

          <p>
            購物車目前是空的
          </p>

          <button
            id="goShoppingButton"
            class="secondary-button"
            type="button"
          >
            去選購蔬菜
          </button>

        </div>

      `;


      const shoppingButton =
        $("goShoppingButton");


      if (shoppingButton) {

        shoppingButton
          .addEventListener(
            "click",
            () => {

              showPage(
                "home"
              );

            }
          );

      }


    } else {

      $("cart").innerHTML =
        items
          .map(item => `

            <div class="cart-item">

              <div class="cart-item-main">

                <div>

                  <b>

                    ${esc(
                      item.p.name
                    )}

                  </b>

                  <small>

                    ${money(
                      item.p.price
                    )}

                    /

                    ${esc(
                      item.p.unit ||
                      "份"
                    )}

                  </small>

                </div>


                <b class="cart-item-price">

                  ${money(
                    Number(
                      item.p.price
                    ) *
                    item.qty
                  )}

                </b>

              </div>


              <div class="cart-item-actions">

                <button
                  class="cart-minus"
                  data-id="${item.p.id}"
                  type="button"
                >
                  −
                </button>


                <b>
                  ${item.qty}
                </b>


                <button
                  class="cart-plus"
                  data-id="${item.p.id}"
                  type="button"
                >
                  ＋
                </button>

              </div>

            </div>

          `)
          .join("");


      document
        .querySelectorAll(
          ".cart-minus"
        )
        .forEach(button => {

          button.addEventListener(
            "click",
            () => {

              changeQty(
                button.dataset.id,
                -1
              );

            }
          );

        });


      document
        .querySelectorAll(
          ".cart-plus"
        )
        .forEach(button => {

          button.addEventListener(
            "click",
            () => {

              changeQty(
                button.dataset.id,
                1
              );

            }
          );

        });

    }

  }


  const { subtotal, discount, bundleQty, total } = priceCart(items);


  $("bundleDiscount").hidden = !bundleQty;
  $("bundleDiscount").textContent = discount
    ? `商品原價 ${money(subtotal)}｜3包50元優惠（${Math.floor(bundleQty / 3)}組）折抵 ${money(discount)}`
    : `專區已選 ${bundleQty} 包，再選 ${3 - bundleQty} 包享3包50元`;
  $("quickCount").textContent = `共 ${count} 件商品`;
  $("quickTotal").textContent = money(total);
  $("headerCartBadge").textContent = count > 99 ? "99+" : String(count);
  $("headerCartBadge").hidden = !count;
  $("quickCart").hidden = currentPage !== "home" || !count;
  if ($("total")) {

    $("total")
      .textContent =
        money(total);

  }

}


/* =========================
   送出訂單
========================= */

if ($("submit")) {

  $("submit")
    .addEventListener(
      "click",
      async () => {

        if(!db || !productsReady) { alert("目前無法送出訂單，請確認商品已載入後再試。"); return; }
        const items = Object.values(cart);


        const name =
          $("name")
            .value
            .trim();


        const phone =
          $("phone")
            .value
            .trim();


        const note =
          $("note")
            .value
            .trim();


        if (!items.length) {

          alert(
            "請先選擇商品"
          );


          showPage(
            "home"
          );


          return;

        }


        if (
          !name ||
          !phone
        ) {

          alert(
            "請填寫姓名與電話"
          );


          return;

        }


        const { subtotal, discount, bundleQty, total } = priceCart(items);


        const order = {

          customerName:
            name,

          customerPhone:
            phone,

          note,

          items:
            items.map(
              item => ({

                name:
                  item.p.name,

                unit:
                  item.p.unit,

                price:
                  Number(
                    item.p.price
                  ),

                qty:
                  item.qty

              })
            ),

          subtotal,
          discount,
          bundleQty,
          promotion: discount ? "3包50元" : "",
          total,

          status:
            "new",

          memberLoggedIn:
            Boolean(member),

          memberId:
            member?.id ||
            null,

          memberName:
            member?.name ||
            null

        };


        $("submit").disabled =
          true;


        $("submit")
          .textContent =
            "訂單送出中...";


        try {

          // Keep the same request ID after network errors to prevent duplicate orders.
          const orderPayload = JSON.stringify(order);
          let pendingOrder;
          try { pendingOrder = JSON.parse(localStorage.getItem("yj_pending_order") || "null"); } catch {}
          if (pendingOrder && pendingOrder.payload !== orderPayload) {
            throw new Error("上一筆訂單尚待確認。請先恢復原訂單內容再送出，或聯絡店家確認後再下新訂單。");
          }
          if (!pendingOrder) {
            pendingOrder = { requestId: crypto.randomUUID(), payload: orderPayload };
            localStorage.setItem("yj_pending_order", JSON.stringify(pendingOrder));
          }
          const response = await fetch(WORKER_URL + "/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(member ? {Authorization: "Bearer " + localStorage.getItem("yj_member_token")} : {}) },
            body: JSON.stringify({ requestId: pendingOrder.requestId, order }),
            signal: AbortSignal.timeout(25000)
          });
          const saved = await response.json();
          if (!response.ok || !saved.ok || !saved.orderId) {
            if (response.status === 400) localStorage.removeItem("yj_pending_order");
            if(response.status === 401) { localStorage.removeItem("yj_member_token"); showLoggedOut(); showPage("member"); }
            throw new Error(saved.error || "訂單尚未確認，請以相同內容重試。");
          }
          const orderId = saved.orderId;
          localStorage.removeItem("yj_pending_order");

          cart = {};


          localStorage.removeItem(
            "yjcart"
          );


          renderProducts();


          $("result").innerHTML = `

            <div class="ok">

              <div
                style="
                  font-size:42px;
                  margin-bottom:10px;
                "
              >
                ✅
              </div>

              <b>
                訂單已送出！
              </b>

              <br><br>

              金額：
              ${money(total)}
              ${discount ? `<br><small>已套用3包50元優惠，折抵 ${money(discount)}</small>` : ""}

              <br>

              <small>

                訂單編號：

                ${esc(
                  makeOrderNumber(
                    orderId
                  )
                )}

              </small>

            </div>

          `;


          $("note").value =
            "";


        } catch (error) {

          console.error(
            "訂單送出失敗：",
            error
          );


          alert(
            error.name === "TimeoutError" || error.name === "TypeError" ? "連線暫時中斷，請保留原訂單內容再次按送出，不會重複建立訂單。" : (error.message || "訂單送出失敗，請稍後再試")
          );


        } finally {

          $("submit").disabled =
            false;


          $("submit")
            .textContent =
              "確認送出訂單";

        }

      }
    );

}


/* =========================
   訂單編號
========================= */

// Display-only suffix; keep the full order ID for storage and lookups.
function makeOrderSuffix(id) {
  let value = 0;
  for (const char of String(id || "")) {
    value = (value * 31 + char.charCodeAt(0)) % 1000;
  }
  return String(value).padStart(3, "0");
}

function makeOrderNumber(id) {

  const now =
    new Date();


  const year =
    now
      .getFullYear()
      .toString()
      .slice(-2);


  const month =
    String(
      now.getMonth() +
      1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}${month}${day}-${makeOrderSuffix(id)}`;

}


/* =========================
   啟動
========================= */

async function start() {

  initNavigation();


  showPage(
    "home"
  );


  /*
    讀取店家資訊
  */

  const settingsTask = loadStoreSettings();


  /*
    LINE 會員
  */

  const memberTask = initMember();


  /*
    商品
  */

  await loadProducts();


  renderCart();

}


start();
