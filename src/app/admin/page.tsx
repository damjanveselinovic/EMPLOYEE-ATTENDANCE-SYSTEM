"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Button from "@/components/Button";
import TextField from "@/components/TextField";
import Modal from "@/components/Modal";
import WfhRequestsAdminCard from "@/components/WfhRequestsAdminCard";
import UserAvatar from "@/components/UserAvatar";
import { fullName } from "@/lib/types/user";
import { fmtLocalDateTimeSR } from "@/lib/date/format";
import { isEmail } from "@/lib/date/validation";

type Role = "EMPLOYEE" | "MANAGER" | "ADMIN";

type UserDTO = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  createdAt: string;
  lastLoginAt: string | null;
};

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();

  // guard
  useEffect(() => {
    if (!user) router.push("/login");
    else if (user.role !== "ADMIN") router.push("/calendar");
  }, [user, router]);

  const [allUsers, setAllUsers] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastBehaviorAnalysis, setLastBehaviorAnalysis] = useState<
    string | null
  >(null);

  const [query, setQuery] = useState("");
  const qNorm = query.trim().toLowerCase();
  const [statusType, setStatusType] = useState<"info" | "error">("info");

  // modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserDTO | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserDTO | null>(null);
  const [resetPwUser, setResetPwUser] = useState<UserDTO | null>(null);

  // forms
  const [formFirst, setFormFirst] = useState("");
  const [formLast, setFormLast] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<Role>("EMPLOYEE");

  const [pwValue, setPwValue] = useState("");

  useEffect(() => {
    if (!statusMsg) return;

    const t = setTimeout(() => {
      setStatusMsg("");
    }, 5000);

    return () => clearTimeout(t);
  }, [statusMsg]);

  // datum poslednjeg pokretanja AI analize ponasanja - pise ga
  // stranica /admin/behavior-analysis posle svakog uspesnog ucitavanja
  useEffect(() => {
    const stored = localStorage.getItem("behaviorAnalysisLastRun");
    if (stored) setLastBehaviorAnalysis(stored);
  }, []);

  async function loadUsers() {
    setLoading(true);

    const res = await fetch("/api/users?mode=admin", {
      method: "GET",
      credentials: "include",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setStatusType("error");
      setStatusMsg(data?.error ?? "Greška pri učitavanju korisnika.");
      setAllUsers([]);
      setLoading(false);
      return;
    }

    const data = await res.json();
    setAllUsers((data.users ?? []) as UserDTO[]);
    setStatusType("info");
    setLoading(false);
  }

  useEffect(() => {
    if (!user || user.role !== "ADMIN") return;
    loadUsers();
  }, [user?.role]);

  const filtered = useMemo(() => {
    if (!qNorm) return allUsers;
    return allUsers.filter((u) => {
      const name = fullName(u).toLowerCase();
      return (
        name.includes(qNorm) ||
        u.firstName.toLowerCase().includes(qNorm) ||
        u.lastName.toLowerCase().includes(qNorm) ||
        u.email.toLowerCase().includes(qNorm)
      );
    });
  }, [allUsers, qNorm]);

  const employees = useMemo(
    () => filtered.filter((u) => u.role === "EMPLOYEE"),
    [filtered]
  );
  const managers = useMemo(
    () => filtered.filter((u) => u.role === "MANAGER"),
    [filtered]
  );

  const counts = useMemo(() => {
    const total = allUsers.length;
    return { total };
  }, [allUsers]);

  function openAdd() {
    setStatusMsg("");
    setFormFirst("");
    setFormLast("");
    setFormEmail("");
    setFormRole("EMPLOYEE");
    setIsAddOpen(true);
  }

  function openEdit(u: UserDTO) {
    setStatusMsg("");
    setFormFirst(u.firstName);
    setFormLast(u.lastName);
    setFormEmail(u.email);
    setFormRole(u.role);
    setEditUser(u);
  }

  async function submitAdd() {
    setBusy(true);
    setStatusMsg("");
    try {
      const firstName = formFirst.trim();
      const lastName = formLast.trim();
      const email = formEmail.trim().toLowerCase();

      if (!firstName || !lastName || !email) {
        setStatusType("error");
        setStatusMsg("Ime, prezime i email su obavezni.");
        return;
      }
      if (!isEmail(email)) {
        setStatusType("error");
        setStatusMsg("Email format nije ispravan.");
        return;
      }
      if (pwValue.trim().length < 6) {
        setStatusType("error");
        setStatusMsg("Lozinka mora imati bar 6 karaktera.");
        return;
      }

      const res = await fetch("/api/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          role: formRole,
          password: pwValue.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatusType("error");
        setStatusMsg(data?.error ?? "Greška pri kreiranju korisnika.");
        return;
      }

      setIsAddOpen(false);
      setStatusType("info");
      setStatusMsg("Korisnik kreiran.");
      setPwValue("");
      await loadUsers();
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit() {
    if (!editUser) return;
    setBusy(true);
    setStatusMsg("");
    try {
      const firstName = formFirst.trim();
      const lastName = formLast.trim();
      const email = formEmail.trim().toLowerCase();

      if (!firstName || !lastName || !email) {
        setStatusType("error");
        setStatusMsg("Ime, prezime i email su obavezni.");
        return;
      }
      if (!isEmail(email)) {
        setStatusType("error");
        setStatusMsg("Email format nije ispravan.");
        return;
      }

      const res = await fetch(`/api/users/${editUser.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          role: formRole,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatusType("error");
        setStatusMsg(data?.error ?? "Greška pri izmeni korisnika.");
        return;
      }
      setStatusType("info");
      setStatusMsg("Korisnik izmenjen.");
      setEditUser(null);
      await loadUsers();
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteUser) return;
    setStatusMsg("");
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${deleteUser.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatusType("error");
        setStatusMsg(data?.error ?? "Greška pri brisanju korisnika.");
        return;
      }

      // 204 = stvarno obrisan (nema tela)
      // 200 = deaktiviran umesto obrisan (ima JSON telo sa deactivated: true)
      let deactivated = false;
      if (res.status === 200) {
        const data = await res.json().catch(() => null);
        deactivated = !!data?.deactivated;
      }

      setStatusType("info");
      setStatusMsg(
        deactivated
          ? "Korisnik ima postojeće podatke (aktivnosti/prisustvo), pa je deaktiviran umesto obrisan."
          : "Korisnik izbrisan."
      );

      const deletedId = deleteUser.id;
      setDeleteUser(null);

      // ukloni odmah iz liste - ne oslanjaj se na loadUsers(),
      // jer GET ruta trenutno možda i dalje vraća neaktivne korisnike
      setAllUsers((prev) => prev.filter((u) => u.id !== deletedId));
    } finally {
      setBusy(false);
    }
  }

  async function submitResetPassword() {
    if (!resetPwUser) return;
    setBusy(true);
    setStatusMsg("");
    try {
      const pw = pwValue.trim();
      if (pw.length < 6) {
        setStatusType("error");
        setStatusMsg("Lozinka mora imati bar 6 karaktera.");
        return;
      }

      const res = await fetch(`/api/users/${resetPwUser.id}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatusType("error");
        setStatusMsg(data?.error ?? "Greška pri resetu lozinke.");
        return;
      }

      setPwValue("");
      setResetPwUser(null);
      setStatusType("info");
      setStatusMsg("Lozinka resetovana.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;
  if (user.role !== "ADMIN") return null;

  function roleBadgeStyle(role: Role) {
    if (role === "ADMIN")
      return {
        background: "#4f46e5",
        color: "#fff",
        padding: "4px 10px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
      };
    if (role === "MANAGER")
      return {
        background: "rgba(79, 70, 229, 0.15)",
        color: "#4338ca",
        padding: "4px 10px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
      };
    return {
      background: "#e5e7eb",
      color: "#374151",
      padding: "4px 10px",
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 600,
    };
  }

  function UserCardRow({ u }: { u: UserDTO }) {
    return (
      <div
        className="card adminUserCard"
        style={{
          display: "grid",
          gap: 14,
          padding: "18px 20px",
          border: "1px solid #d7dbe2",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
          marginTop: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }} className="flex items-center gap-x-4">
            <UserAvatar
              firstName={u.firstName}
              lastName={u.lastName}
              email={u.email}
              size={36}
            />
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {fullName(u)}
                </span>
                <span style={roleBadgeStyle(u.role)}>{u.role}</span>
              </div>
              <div
                className="muted"
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginTop: 4,
                  fontSize: 14,
                }}
              >
                {u.email}
              </div>
            </div>
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Last login: {fmtLocalDateTimeSR(u.lastLoginAt)}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            paddingTop: 4,
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <Button onClick={() => openEdit(u)}>Izmeni</Button>
          <Button onClick={() => setDeleteUser(u)}>Obriši</Button>
          <Button
            onClick={() => {
              setResetPwUser(u);
              setPwValue("");
            }}
          >
            Resetuj password
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main>
      {/* Dashboard header */}
      <header
        style={{
          marginBottom: 28,
          paddingBottom: 20,
          borderBottom: "2px solid #e5e7eb",
        }}
      >
        <h1 className="h1" style={{ fontSize: 28, marginBottom: 6 }}>
          Admin
        </h1>
        <p className="h2" style={{ fontSize: 16, margin: 0 }}>
          Upravljanje korisnicima (DB).
        </p>
      </header>

      <WfhRequestsAdminCard />

      {/* AI analiza ponasanja / rizik od burnout-a */}
      <div
        className="card"
        style={{
          marginTop: 24,
          padding: 24,
          border: "1px solid #d7dbe2",
          borderLeft: "4px solid #4f46e5",
          boxShadow: "0 4px 24px rgba(15, 23, 42, 0.12)",
        }}
      >
        <h2
          className="sectionTitle"
          style={{ margin: "0 0 8px 0", fontSize: 18 }}
        >
          Analiza ponašanja zaposlenih (AI)
        </h2>
        <p className="muted" style={{ margin: "0 0 4px 0", fontSize: 14 }}>
          Model mašinskog učenja (Random Forest / Gradient Boosting) analizira
          obrazac prisustva svakog zaposlenog u poslednjih ~2 meseca (radno
          vreme, kašnjenja, odsustva) i procenjuje rizik od burnout-a na osnovu
          promene ponašanja u odnosu na sopstveni prosek.
        </p>
        <p className="muted" style={{ margin: "0 0 16px 0", fontSize: 13 }}>
          Poslednja provera:{" "}
          <b>
            {lastBehaviorAnalysis
              ? fmtLocalDateTimeSR(lastBehaviorAnalysis)
              : "još nije pokrenuta"}
          </b>
        </p>
        <Button
          variant="primary"
          onClick={() => router.push("/admin/behavior-analysis")}
        >
          Analiziraj ponašanje korisnika
        </Button>
      </div>

      {/* Top bar: search + create */}
      <div
        className="card"
        style={{
          marginTop: 24,
          padding: 24,
          border: "1px solid #d7dbe2",
          borderLeft: "4px solid #4f46e5",
          boxShadow: "0 4px 24px rgba(15, 23, 42, 0.12)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 260 }}>
            <TextField
              label="Pretraga"
              value={query}
              onChange={setQuery}
              placeholder="Ime / prezime / email…"
            />
          </div>

          <div
            className="muted"
            style={{
              paddingBottom: 2,
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            Ukupno: <span style={{ color: "inherit" }}>{counts.total}</span>
          </div>

          <div style={{ alignSelf: "flex-end" }}>
            <Button variant="primary" onClick={openAdd}>
              Kreiraj korisnika
            </Button>
          </div>
        </div>

        {statusMsg ? (
          <div
            className={`notice ${statusType === "error" ? "notice-error" : ""}`}
            style={{ marginTop: 10 }}
          >
            {statusMsg}
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 22,
        }}
      >
        <div
          className="card"
          style={{
            padding: 24,
            border: "1px solid #d7dbe2",
            boxShadow: "0 4px 20px rgba(15, 23, 42, 0.08)",
            borderRadius: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              paddingBottom: 14,
              borderBottom: "2px solid #e5e7eb",
            }}
          >
            <h2 className="sectionTitle" style={{ margin: 0, fontSize: 20 }}>
              Radnici
            </h2>
            <span className="muted" style={{ fontWeight: 600, fontSize: 14 }}>
              Prikaz: {employees.length}
            </span>
          </div>

          {loading ? (
            <div className="muted" style={{ marginTop: 12 }}>
              Učitavam…
            </div>
          ) : employees.length === 0 ? (
            <div className="muted" style={{ marginTop: 12 }}>
              Nema rezultata.
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              {employees.map((u) => (
                <UserCardRow key={u.id} u={u} />
              ))}
            </div>
          )}
        </div>

        <div
          className="card"
          style={{
            padding: 24,
            border: "1px solid #d7dbe2",
            boxShadow: "0 4px 20px rgba(15, 23, 42, 0.08)",
            borderRadius: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              paddingBottom: 14,
              borderBottom: "2px solid #e5e7eb",
            }}
          >
            <h2 className="sectionTitle" style={{ margin: 0, fontSize: 20 }}>
              Menadžeri
            </h2>
            <span className="muted" style={{ fontWeight: 600, fontSize: 14 }}>
              Prikaz: {managers.length}
            </span>
          </div>

          {loading ? (
            <div className="muted" style={{ marginTop: 12 }}>
              Učitavam…
            </div>
          ) : managers.length === 0 ? (
            <div className="muted" style={{ marginTop: 12 }}>
              Nema rezultata.
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              {managers.map((u) => (
                <UserCardRow key={u.id} u={u} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ADD modal */}
      {isAddOpen ? (
        <Modal
          open={isAddOpen}
          title="Kreiraj korisnika"
          onClose={() => {
            setIsAddOpen(false);
            setPwValue("");
          }}
        >
          <div style={{ display: "grid", gap: 12 }}>
            {statusMsg ? (
              <div
                className={`notice ${
                  statusType === "error" ? "notice-error" : ""
                }`}
              >
                {statusMsg}
              </div>
            ) : null}

            <TextField label="Ime" value={formFirst} onChange={setFormFirst} />
            <TextField
              label="Prezime"
              value={formLast}
              onChange={setFormLast}
            />
            <TextField
              label="Email"
              value={formEmail}
              onChange={setFormEmail}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontWeight: 700 }}>Uloga</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as Role)}
                className="select"
              >
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="MANAGER">MANAGER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <TextField
              label="Lozinka (inicijalna)"
              value={pwValue}
              onChange={setPwValue}
              placeholder="min. 6 karaktera"
            />

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              <Button
                onClick={() => {
                  setIsAddOpen(false);
                  setPwValue("");
                }}
              >
                Poništi
              </Button>
              <Button variant="primary" onClick={submitAdd}>
                Kreiraj
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* EDIT modal */}
      {editUser ? (
        <Modal
          open={!!editUser}
          title="Edit user"
          onClose={() => setEditUser(null)}
        >
          <div style={{ display: "grid", gap: 12 }}>
            {statusMsg ? (
              <div
                className={`notice ${
                  statusType === "error" ? "notice-error" : ""
                }`}
              >
                {statusMsg}
              </div>
            ) : null}

            <div className="muted">
              ID: <b>{editUser.id}</b> | Kreiran:{" "}
              <b>{fmtLocalDateTimeSR(editUser.createdAt)}</b>
            </div>

            <TextField label="Ime" value={formFirst} onChange={setFormFirst} />
            <TextField
              label="Prezime"
              value={formLast}
              onChange={setFormLast}
            />
            <TextField
              label="Email"
              value={formEmail}
              onChange={setFormEmail}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label>Uloga</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as Role)}
                className="select"
              >
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="MANAGER">MANAGER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              <Button onClick={() => setEditUser(null)}>Cancel</Button>
              <Button variant="primary" onClick={submitEdit}>
                Save
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* DELETE confirm modal */}
      {deleteUser ? (
        <Modal
          open={!!deleteUser}
          title="Potvrdi brisanje"
          onClose={() => setDeleteUser(null)}
        >
          <div style={{ display: "grid", gap: 12 }}>
            {statusMsg ? (
              <div
                className={`notice ${
                  statusType === "error" ? "notice-error" : ""
                }`}
              >
                {statusMsg}
              </div>
            ) : null}

            <div>
              Da li si siguran da želiš da obrišeš korisnika:
              <div style={{ marginTop: 8 }}>
                <b>{fullName(deleteUser)}</b> ({deleteUser.email})
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                Ako postoje aktivnosti/prisustva, brisanje može biti blokirano —
                u tom slučaju deaktiviraj.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              <Button onClick={() => setDeleteUser(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* RESET PASSWORD modal */}
      {resetPwUser ? (
        <Modal
          open={!!resetPwUser}
          title="Reset password"
          onClose={() => {
            setResetPwUser(null);
            setPwValue("");
          }}
        >
          <div style={{ display: "grid", gap: 12 }}>
            {statusMsg ? (
              <div
                className={`notice ${
                  statusType === "error" ? "notice-error" : ""
                }`}
              >
                {statusMsg}
              </div>
            ) : null}

            <div>
              Reset lozinke za: <b>{fullName(resetPwUser)}</b>
              <div className="muted">{resetPwUser.email}</div>
            </div>

            <TextField
              label="Nova lozinka"
              value={pwValue}
              onChange={setPwValue}
              placeholder="min 6 karaktera"
            />

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              <Button
                onClick={() => {
                  setResetPwUser(null);
                  setPwValue("");
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={submitResetPassword}>
                Reset
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
