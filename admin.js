import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";

const ADMIN_UID = "r8lFDyFoDTUffnwN6waBm0cMlHl1";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const $ = id => document.getElementById(id);

const money = n =>
  "NT$" + Number(n || 0).toLocaleString("zh-TW");

const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));


/* =========================
   管理員登入
========================= */

$("loginBtn").onclick = async () => {

  const email = $("email").value.trim();
  const password = $("password").value;

  $("msg").textContent = "登入中...";

  if (!email || !password) {
    $("msg").textContent = "請輸入 Email 和密碼";
    return;
  }

  try {

    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (result.user.uid !== ADMIN_UID) {
      await signOut(auth);
      $("msg").textContent = "此帳號沒有管理員權限";
      return;
    }

    $("msg").textContent = "";

  } catch (error) {

    console.error(error);
    $("msg").textContent = "登入失敗，請確認 Email 或密碼";

  }
};


/* =========================
   登出
========================= */

$("logoutBtn").onclick = async () => {
  await signOut(auth);
};


/* =========================
   登入狀態
========================= */

onAuthStateChanged(auth, async user => {

  if (user && user.uid === ADMIN_UID) {

    $("login").hidden = true;
    $("panel").hidden = false;

    await loadP();
    await loadO();

  } else {

    $("login").hidden = false;
    $("panel").hidden = true;

  }

});


/* =========================
   頁籤
========================= */

$("ot").onclick = () => {
  $("ordersPanel").hidden = false;
};

$("pt").onclick = () => {
  $("ordersPanel").hidden = true;
};


/* =========================
   新增商品
========================= */

$("add").onclick = () => edit({
  name: "新商品",
  unit: "斤",
  price: 0,
  emoji: "🥬",
  active: true,
  sort: 999
});


/* =========================
   讀取商品
========================= */

async function loadP() {

  try {

    const snapshot =
      await getDocs(collection(db, "products"));

    const products =
      snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

    $("products").innerHTML =
      products.map(p => `

        <div class="row">

          <span>
            ${esc(p.emoji || "🥬")}
            <b>${esc(p.name)}</b>
            ｜${esc(p.unit)}
            ｜${money(p.price)}
            ｜${p.active === false ? "下架" : "上架"}
          </span>

          <span>
            <button onclick='edit(${JSON.stringify(p)})'>
              編輯
            </button>

            <button onclick="delP('${p.id}')">
              刪除
            </button>
          </span>

        </div>

      `).join("") || "尚無商品";

  } catch (error) {

    console.error(error);
    $("products").innerHTML =
      '<div class="notice">商品讀取失敗</div>';

  }

}


/* =========================
   編輯商品
========================= */

window.edit = async p => {

  const name = prompt("商品名稱", p.name);
  if (name === null) return;

  const unit = prompt("單位", p.unit);
  if (unit === null) return;

  const price = prompt("單價", p.price);
  if (price === null) return;

  const emoji = prompt(
    "Emoji",
    p.emoji || "🥬"
  );

  if (emoji === null) return;

  const active =
    confirm("按「確定」＝上架\n按「取消」＝下架");

  const data = {
    name,
    unit,
    price: Number(price),
    emoji,
    active,
    sort: p.sort ?? 999
  };

  try {

    if (p.id) {

      await updateDoc(
        doc(db, "products", p.id),
        data
      );

    } else {

      await addDoc(
        collection(db, "products"),
        data
      );

    }

    await loadP();

  } catch (error) {

    console.error(error);
    alert("商品儲存失敗");

  }

};


/* =========================
   刪除商品
========================= */

window.delP = async id => {

  if (!confirm("確定刪除這個商品？")) {
    return;
  }

  try {

    await deleteDoc(
      doc(db, "products", id)
    );

    await loadP();

  } catch (error) {

    console.error(error);
    alert("商品刪除失敗");

  }

};


/* =========================
   訂單管理
========================= */

async function loadO() {

  try {

    const snapshot = await getDocs(
      query(
        collection(db, "orders"),
        orderBy("createdAt", "desc")
      )
    );

    $("orders").innerHTML =
      snapshot.docs.map(d => {

        const o = d.data();

        return `

          <div class="order">

            <b>${esc(o.customerName || "")}</b>
            ｜${esc(o.customerPhone || "")}

            <br>

            ${(o.items || []).map(i =>
              `${esc(i.name)} × ${Number(i.qty || 0)}`
            ).join("、")}

            <br>

            金額：${money(o.total)}

            <br>

            備註：${esc(o.note || "無")}

          </div>

        `;

      }).join("") || "尚無訂單";

  } catch (error) {

    console.error(error);

    $("orders").innerHTML =
      '<div class="notice">訂單讀取失敗</div>';

  }

}
