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


const WORKER_URL =
  "https://yingjie-line-login.twm0987373440.workers.dev";


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
    id: "d" + index,
    name: item[0],
    unit: item[1],
    price: item[2],
    emoji: item[3],
    active: true,
    sort: index
  })
);


const configured =
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith(
    "YOUR_"
  );


const db =
  configured
    ? getFirestore(
        initializeApp(
          firebaseConfig
        )
      )
    : null;


let products = [];


let cart =
  JSON.parse(
    localStorage.getItem(
      "yjcart"
    ) || "{}"
  );


let member = null;


const $ =
  id =>
    document.getElementById(id);


const money =
  n =>
    "NT$" +
    Number(n || 0)
      .toLocaleString(
        "zh-TW"
      );


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
   LINE 會員
========================= */

async function initMember() {

  /*
    LINE 登入成功後 Worker 會把 Token
    放在網址 #member_token=...
  */

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


    /*
      清掉網址上的 token，
      避免一直留在網址列。
    */

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
          method: "GET",

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


  $("memberLoggedOut").hidden =
    false;


  $("memberLoggedIn").hidden =
    true;

}


function showLoggedIn(data) {

  $("memberLoggedOut").hidden =
    true;


  $("memberLoggedIn").hidden =
    false;


  $("memberName").textContent =
    `${data.name}，您好`;


  if (data.picture) {

    $("memberPicture").src =
      data.picture;


    $("memberPicture").style.display =
      "block";

  } else {

    $("memberPicture").style.display =
      "none";

  }


  /*
    姓名空白時，自動帶入 LINE 名稱。
    使用者仍然可以自行修改。
  */

  if (
    !$("name").value.trim()
  ) {

    $("name").value =
      data.name || "";

  }

}


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


/* =========================
   商品
========================= */

async function loadProducts() {

  if (!db) {

    products = demo;

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
          id: docItem.id,
          ...docItem.data()
        }))
        .filter(
          product =>
            product.active !== false
        )
        .sort(
          (a, b) =>
            (a.sort ?? 999) -
            (b.sort ?? 999)
        );


    if (!products.length) {

      products = demo;

    }


    setStatus(
      "商品已更新"
    );


    renderProducts();


  } catch (error) {

    console.error(
      "商品讀取失敗：",
      error
    );


    products = demo;


    setStatus(
      "Firebase 讀取失敗，暫時顯示示範商品。"
    );


    renderProducts();

  }

}


function setStatus(text) {

  $("status").textContent =
    text;

}


/* =========================
   商品畫面
========================= */

function renderProducts() {

  $("products").innerHTML =
    products
      .map(product => {

        const qty =
          cart[product.id]?.qty ||
          0;


        return `

          <article class="card">

            <div class="emoji">
              ${esc(
                product.emoji ||
                "🥬"
              )}
            </div>

            <h3>
              ${esc(product.name)}
            </h3>

            <small>
              ${esc(
                product.unit ||
                "份"
              )}
            </small>

            <div class="price">

              ${money(
                product.price
              )}

              <small>
                /
                ${esc(
                  product.unit ||
                  "份"
                )}
              </small>

            </div>

            <div class="qty">

              <button
                class="qty-minus"
                data-id="${product.id}"
                type="button"
              >
                −
              </button>

              <b>
                ${qty}
              </b>

              <button
                class="qty-plus"
                data-id="${product.id}"
                type="button"
              >
                ＋
              </button>

            </div>

          </article>

        `;

      })
      .join("");


  document
    .querySelectorAll(
      ".qty-minus"
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
      ".qty-plus"
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


  renderCart();

}


/* =========================
   數量
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
    cart[id]?.qty || 0;


  const qty =
    Math.max(
      0,
      currentQty + change
    );


  if (qty > 0) {

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


  renderProducts();

}


/* =========================
   購物車
========================= */

function renderCart() {

  const items =
    Object.values(cart);


  const count =
    items.reduce(
      (sum, item) =>
        sum + item.qty,
      0
    );


  $("count").textContent =
    count + " 項";


  if (!items.length) {

    $("cart").innerHTML =
      "<p>尚未選擇商品</p>";

  } else {

    $("cart").innerHTML =
      items
        .map(item => `

          <div class="row">

            <span>

              ${esc(
                item.p.name
              )}

              ×
              ${item.qty}

            </span>

            <b>

              ${money(
                Number(
                  item.p.price
                ) *
                item.qty
              )}

            </b>

          </div>

        `)
        .join("");

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


  $("total").textContent =
    money(total);

}


/* =========================
   送出訂單
========================= */

$("submit")
  .addEventListener(
    "click",
    async () => {

      const items =
        Object.values(cart);


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

        return;

      }


      if (!name || !phone) {

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
          items.map(item => ({

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

          })),

        total,

        status:
          "new",

        /*
          目前只記錄是否透過會員登入。
          下一階段再安全綁定會員訂單查詢。
        */

        memberLoggedIn:
          Boolean(member)

      };


      $("submit").disabled =
        true;


      $("submit").textContent =
        "訂單送出中...";


      try {

        let orderId = "";


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

            <b>
              訂單已送出！
            </b>

            <br>

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


        $("submit").textContent =
          "送出訂單";

      }

    }
  );


/* =========================
   顯示用訂單編號
========================= */

function makeOrderNumber(
  id
) {

  const now =
    new Date();


  const year =
    now
      .getFullYear()
      .toString()
      .slice(-2);


  const month =
    String(
      now.getMonth() + 1
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

  await initMember();

  await loadProducts();

}


start();
