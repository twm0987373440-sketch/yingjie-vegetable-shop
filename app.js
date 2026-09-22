import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  firebaseConfig
} from "./firebase-config.js";


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


let products = [];

let cart =
  JSON.parse(
    localStorage.getItem("yjcart") || "{}"
  );


const $ = id =>
  document.getElementById(id);


const money = n =>
  "NT$" +
  Number(n || 0).toLocaleString("zh-TW");


const esc = s =>
  String(s ?? "").replace(
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
   載入商品
========================= */

async function load() {

  try {

    const snapshot =
      await getDocs(
        collection(db, "products")
      );


    products =
      snapshot.docs
        .map(d => ({
          id: d.id,
          ...d.data()
        }))
        .filter(p =>
          p.active !== false
        )
        .sort(
          (a, b) =>
            (a.sort ?? 999) -
            (b.sort ?? 999)
        );


    if (!products.length) {

      status(
        "目前沒有上架商品"
      );

    } else {

      status(
        "商品已更新"
      );

    }


    render();


  } catch (error) {

    console.error(error);

    status(
      "商品讀取失敗，請稍後再試。"
    );

  }

}


function status(text) {
  $("status").textContent = text;
}


/* =========================
   商品畫面
========================= */

function render() {

  $("products").innerHTML =
    products.map(p => `

      <article class="card">

        <div class="emoji">
          ${p.emoji || "🥬"}
        </div>

        <h3>
          ${esc(p.name)}
        </h3>

        <small>
          ${esc(p.unit || "份")}
        </small>

        <div class="price">

          ${money(p.price)}

          <small>
            / ${esc(p.unit || "份")}
          </small>

        </div>

        <div class="qty">

          <button
            onclick="chg('${p.id}', -1)"
          >
            −
          </button>

          <b>
            ${cart[p.id]?.qty || 0}
          </b>

          <button
            onclick="chg('${p.id}', 1)"
          >
            ＋
          </button>

        </div>

      </article>

    `).join("");


  renderCart();

}


/* =========================
   修改數量
========================= */

window.chg = (id, change) => {

  const product =
    products.find(
      p => p.id === id
    );


  if (!product) return;


  const qty =
    Math.max(
      0,
      (cart[id]?.qty || 0) +
      change
    );


  if (qty) {

    cart[id] = {
      p: product,
      qty
    };

  } else {

    delete cart[id];

  }


  localStorage.setItem(
    "yjcart",
    JSON.stringify(cart)
  );


  render();

};


/* =========================
   購物車
========================= */

function renderCart() {

  const items =
    Object.values(cart);


  $("count").textContent =
    items.reduce(
      (sum, item) =>
        sum + item.qty,
      0
    ) + " 項";


  $("cart").innerHTML =
    items.length

      ? items.map(item => `

          <div class="row">

            <span>
              ${esc(item.p.name)}
              ×
              ${item.qty}
            </span>

            <b>
              ${money(
                item.p.price *
                item.qty
              )}
            </b>

          </div>

        `).join("")

      : "<p>尚未選擇商品</p>";


  const total =
    items.reduce(
      (sum, item) =>
        sum +
        Number(item.p.price) *
        item.qty,
      0
    );


  $("total").textContent =
    money(total);

}


/* =========================
   送出訂單
========================= */

$("submit").onclick =
async () => {

  const items =
    Object.values(cart);


  const name =
    $("name").value.trim();


  const phone =
    $("phone").value.trim();


  const deliveryMethod =
    $("deliveryMethod").value;


  const pickupTime =
    $("pickupTime").value;


  const note =
    $("note").value.trim();


  if (!items.length) {

    alert(
      "請先選擇商品"
    );

    return;

  }


  if (!name || !phone) {

    alert(
      "請填寫姓名與電話"
    );

    return;

  }


  if (!pickupTime) {

    alert(
      "請選擇希望取貨／配送時間"
    );

    return;

  }


  const total =
    items.reduce(
      (sum, item) =>
        sum +
        Number(item.p.price) *
        item.qty,
      0
    );


  const order = {

    customerName: name,

    customerPhone: phone,

    deliveryMethod,

    pickupTime,

    note,

    items:
      items.map(item => ({

        name:
          item.p.name,

        unit:
          item.p.unit,

        price:
          Number(item.p.price),

        qty:
          item.qty

      })),

    total,

    status: "new",

    createdAt:
      serverTimestamp()

  };


  try {

    $("submit").disabled = true;

    $("submit").textContent =
      "送出中…";


    const ref =
      await addDoc(
        collection(db, "orders"),
        order
      );


    const now =
      new Date();


    const date =
      [
        now.getFullYear(),
        String(
          now.getMonth() + 1
        ).padStart(2, "0"),
        String(
          now.getDate()
        ).padStart(2, "0")
      ].join("");


    const orderNumber =
      date +
      "-" +
      ref.id
        .slice(0, 6)
        .toUpperCase();


    cart = {};

    localStorage.removeItem(
      "yjcart"
    );


    renderCart();


    $("name").value = "";

    $("phone").value = "";

    $("pickupTime").value = "";

    $("note").value = "";


    $("result").innerHTML = `

      <div class="ok">

        <b>✅ 訂單已送出！</b>

        <br>

        訂單編號：
        ${esc(orderNumber)}

        <br>

        金額：
        ${money(total)}

      </div>

    `;


  } catch (error) {

    console.error(error);

    alert(
      "送出失敗，請稍後再試"
    );


  } finally {

    $("submit").disabled = false;

    $("submit").textContent =
      "送出訂單";

  }

};


load();
