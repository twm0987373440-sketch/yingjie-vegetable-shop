import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

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

import {
  firebaseConfig
} from "./firebase-config.js";


const ADMIN_UID = "r8lFDyFoDTUffnwN6waBm0cMlHl1";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const $ = id => document.getElementById(id);

const money = n =>
  "NT$" + Number(n || 0).toLocaleString("zh-TW");

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

    const result =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    if (result.user.uid !== ADMIN_UID) {

      await signOut(auth);

      $("msg").textContent =
        "此帳號沒有管理員權限";

      return;
    }

    $("msg").textContent = "";

  } catch (error) {

    console.error(error);

    $("msg").textContent =
      "登入失敗，請確認 Email 或密碼";
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
   商品 / 訂單頁籤
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

$("add").onclick = () =>
  edit({
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
      await getDocs(
        collection(db, "products")
      );

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

            ｜${
              p.active === false
                ? "下架"
                : "上架"
            }

          </span>

          <span>

            <button
              onclick='edit(${JSON.stringify(p)})'
            >
              編輯
            </button>

            <button
              onclick="delP('${p.id}')"
            >
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

  const name =
    prompt("商品名稱", p.name);

  if (name === null) return;


  const unit =
    prompt("單位", p.unit);

  if (unit === null) return;


  const price =
    prompt("單價", p.price);

  if (price === null) return;


  const emoji =
    prompt(
      "Emoji",
      p.emoji || "🥬"
    );

  if (emoji === null) return;


  const active =
    confirm(
      "按「確定」＝上架\n按「取消」＝下架"
    );


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
        doc(
          db,
          "products",
          p.id
        ),
        data
      );

    } else {

      await addDoc(
        collection(
          db,
          "products"
        ),
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

  if (
    !confirm("確定刪除這個商品？")
  ) {
    return;
  }

  try {

    await deleteDoc(
      doc(
        db,
        "products",
        id
      )
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

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "orders"
          ),
          orderBy(
            "createdAt",
            "desc"
          )
        )
      );


    const orders =
      snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));


    /* =====================
       待處理訂單
    ===================== */

    const pendingOrders =
      orders.filter(
        o => o.status !== "completed"
      );


    /* =====================
       今日訂單
    ===================== */

    const now = new Date();

    const todayOrders =
      orders.filter(o => {

        if (
          !o.createdAt ||
          !o.createdAt.toDate
        ) {
          return false;
        }

        const date =
          o.createdAt.toDate();

        return (
          date.getFullYear() ===
            now.getFullYear() &&

          date.getMonth() ===
            now.getMonth() &&

          date.getDate() ===
            now.getDate()
        );
      });


    /* =====================
       今日營業額
    ===================== */

    const todayTotal =
      todayOrders.reduce(
        (sum, order) =>
          sum +
          Number(order.total || 0),
        0
      );


    /* =====================
       今日統計
    ===================== */

    const summary = `

      <div
        class="panel"
        style="margin-bottom:16px"
      >

        <h3>
          📊 今日訂單統計
        </h3>

        <div
          style="
            display:flex;
            gap:20px;
            flex-wrap:wrap;
            font-size:18px;
          "
        >

          <div>
            今日訂單：
            <b>
              ${todayOrders.length} 筆
            </b>
          </div>

          <div>
            今日營業額：
            <b>
              ${money(todayTotal)}
            </b>
          </div>

          <div>
            待處理訂單：
            <b>
              ${pendingOrders.length} 筆
            </b>
          </div>

        </div>

      </div>

    `;


    /* =====================
       訂單列表
    ===================== */

    const orderHTML =
      orders.map(o => {

        let timeText =
          "時間未記錄";

        if (
          o.createdAt &&
          o.createdAt.toDate
        ) {

          timeText =
            o.createdAt
              .toDate()
              .toLocaleString(
                "zh-TW",
                {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit"
                }
              );
        }


        const completed =
          o.status === "completed";


        return `

          <div
            class="order"
            style="
              margin-bottom:15px;
              padding:15px;
              border:1px solid #ddd;
              border-radius:10px;
            "
          >

            <div
              style="
                margin-bottom:8px;
              "
            >

              <b
                style="
                  font-size:18px;
                "
              >

                ${
                  completed
                    ? "🟢 已完成"
                    : "🟠 新訂單"
                }

              </b>

            </div>


            <div>
              🕐 ${esc(timeText)}
            </div>


            <br>


            <div>

              👤

              <b>
                ${esc(
                  o.customerName || ""
                )}
              </b>

              ｜

              📞
              ${esc(
                o.customerPhone || ""
              )}

            </div>


            <br>


            <div>

              🥬

              ${
                (o.items || [])
                  .map(i =>
                    `${esc(i.name)} × ${Number(i.qty || 0)}`
                  )
                  .join("、")
              }

            </div>


            <br>


            <div>

              💰 金額：

              <b>
                ${money(o.total)}
              </b>

            </div>


            <div>

              📝 備註：

              ${esc(
                o.note || "無"
              )}

            </div>


            <br>


            ${
              completed

                ? `

                  <button
                    onclick="
                      setOrderStatus(
                        '${o.id}',
                        'new'
                      )
                    "
                  >
                    ↩️ 恢復新訂單
                  </button>

                `

                : `

                  <button
                    onclick="
                      setOrderStatus(
                        '${o.id}',
                        'completed'
                      )
                    "
                  >
                    ✓ 完成訂單
                  </button>

                `
            }


            <button
              onclick="
                deleteOrder(
                  '${o.id}'
                )
              "
            >
              🗑 刪除
            </button>

          </div>

        `;

      }).join("");


    $("orders").innerHTML =
      summary +
      (
        orderHTML ||
        '<div class="notice">尚無訂單</div>'
      );


  } catch (error) {

    console.error(error);

    $("orders").innerHTML =
      '<div class="notice">訂單讀取失敗</div>';
  }
}


/* =========================
   完成 / 恢復訂單
========================= */

window.setOrderStatus =
async (id, status) => {

  try {

    await updateDoc(
      doc(
        db,
        "orders",
        id
      ),
      {
        status
      }
    );

    await loadO();

  } catch (error) {

    console.error(error);

    alert(
      "訂單狀態更新失敗"
    );
  }
};


/* =========================
   刪除訂單
========================= */

window.deleteOrder =
async id => {

  const ok =
    confirm(
      "確定要刪除這張訂單嗎？\n\n刪除後無法復原。"
    );

  if (!ok) return;


  try {

    await deleteDoc(
      doc(
        db,
        "orders",
        id
      )
    );

    await loadO();

  } catch (error) {

    console.error(error);

    alert(
      "訂單刪除失敗"
    );
  }
};
