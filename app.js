import { photoSource, categoryOf, cartProduct, reconcileCart } from "./shop-utils.js";
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  serverTimestamp
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


  } catch (error) {

    console.error(
      "會員驗證失敗：",
      error
    );


    showLoggedOut();

  }

}


function showLoggedOut() {

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
  const visible = products.filter(p => activeCategory === "all" || categoryOf(p) === activeCategory);
  $("products").innerHTML = visible.map(p => {
    const qty = cart[p.id]?.qty || 0;
    const photo = photoSource(p.photo);
    return `<article class="card">
      <button class="product-photo" type="button" data-photo-id="${esc(p.id)}" aria-label="放大${esc(p.name)}照片" ${photo ? "" : "disabled"}>
        ${photo ? `<img src="${esc(photo)}" alt="${esc(p.name)}" loading="lazy" decoding="async">` : `<span class="photo-placeholder"><span>${esc(p.emoji || "🥬")}</span><small>照片準備中</small></span>`}
      </button>
      <div class="product-info"><h3>${esc(p.name)}</h3><div class="product-bottom"><div class="price">${money(p.price)} <small>/ ${esc(p.unit || "份")}</small></div>
      <div class="qty"><button class="qty-minus" data-id="${esc(p.id)}" type="button" aria-label="減少${esc(p.name)}" ${qty ? "" : "disabled"}>−</button><b>${qty}</b><button class="qty-plus" data-id="${esc(p.id)}" type="button" aria-label="增加${esc(p.name)}">＋</button></div></div></div>
    </article>`;
  }).join("") || '<p class="category-empty">此分類目前沒有商品</p>';
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
  if(!p || !photoSource(p.photo)) return;
  $("zoomPhoto").src = photoSource(p.photo); $("zoomPhoto").alt = p.name;
  $("zoomCaption").textContent = p.name; $("photoDialog").showModal();
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


  const total =
    items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.p.price
        ) *
        item.qty,
      0
    );


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


        const total =
          items.reduce(
            (sum, item) =>
              sum +
              Number(
                item.p.price
              ) *
              item.qty,
            0
          );


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

          let orderId =
            "";


          if (db) {

            const result =
              await addDoc(
                collection(
                  db,
                  "orders"
                ),
                {

                  ...order,

                  createdAt:
                    serverTimestamp()

                }
              );


            orderId =
              result.id;


          } else {

            orderId =
              "DEMO-" +
              Date.now();


            localStorage.setItem(
              "lastOrder",
              JSON.stringify(
                order
              )
            );

          }


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
            "訂單送出失敗，請稍後再試"
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


  const shortId =
    String(id || "")
      .replace(
        /[^a-zA-Z0-9]/g,
        ""
      )
      .slice(
        0,
        6
      )
      .toUpperCase();


  return (
    `${year}${month}${day}-` +
    `${shortId || "ORDER"}`
  );

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
