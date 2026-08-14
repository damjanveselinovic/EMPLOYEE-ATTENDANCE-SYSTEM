"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import TextField from "@/components/TextField";
import { addDays, startOfWeekMonday, toISODate } from "@/lib/date/date";
import { getWeatherIcon } from "@/lib/weather/weather.ui";
import { isoToHHMM, safeToISOString } from "@/lib/date/format";
import {
  isValidTimeHHMM,
  timeToMinutes,
  isValidISODateYYYYMMDD,
} from "@/lib/date/validation";
import {
  startOfYearYMD,
  endOfYearYMD,
  mergeUniqueHolidays,
  type Holiday,
} from "@/lib/holidays/holidays";
import { ownerLabel } from "@/lib/activities/activity";
import {
  buildMonthWeeks,
  startOfWeekMondayLocal,
  weekDayNames,
  ymdLocal,
  isSameYMD,
  isInWorkWeekRange,
} from "@/lib/attendance/weekPicker";

import { useAuth } from "@/components/AuthProvider";

const dayNames = ["Pon", "Uto", "Sre", "Čet", "Pet"];

type Activity = {
  id: number;
  name: string;
  description: string | null;
  descriptionSource: "MANUAL" | "AI" | null;
  date: string;
  startTime: string;
  endTime: string;
  user: { id: number; email: string; firstName: string; lastName: string };
  type: { id: number; name: string };
};
type WeatherDay = {
  date: string; // YYYY-MM-DD
  tempMax: number | null;
  tempMin: number | null;
  precipSum: number | null;
  windMax: number | null;
  weatherCode: number | null;
};

export default function CalendarPage() {
  const { user } = useAuth();
  const canEditActivities = user?.role === "MANAGER" || user?.role === "ADMIN";

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeekMonday(new Date())
  );

  const weekStartStr = toISODate(weekStart);
  const weekEndStr = toISODate(addDays(weekStart, 4));
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [hoverWeekStart, setHoverWeekStart] = useState<string | null>(null); // YYYY-MM-DD ponedeljak

  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const [weather, setWeather] = useState<WeatherDay[]>([]);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState<"info" | "error">("info");
  const [busy, setBusy] = useState(false);

  const [exportBusy, setExportBusy] = useState(false);
  const [exportUserId, setExportUserId] = useState<string>("");

  const router = useRouter();
  const searchParams = useSearchParams();

  const [wfhHint, setWfhHint] = useState<string>("");
  const [wfhOpen, setWfhOpen] = useState(false);
  const [wfhDate, setWfhDate] = useState("");
  const [wfhReason, setWfhReason] = useState("");
  const [wfhErr, setWfhErr] = useState("");
  const [wfhBusy, setWfhBusy] = useState(false);

  const isEmployee = user?.role === "EMPLOYEE";

  useEffect(() => {
    const wfh = searchParams.get("wfh");
    if (wfh !== "1") return;

    setWfhHint(
      "Izaberi dan za koji želiš da pošalješ WFH zahtev. Opcija je dostupna samo kada su ispunjeni uslovi lošeg vremena (npr. temperatura ispod definisanog praga)."
    );

    const t = setTimeout(() => setWfhHint(""), 10000);

    router.replace("/calendar");

    return () => clearTimeout(t);
  }, [searchParams, router]);

  useEffect(() => {
    if (!statusMsg) return;
    const t = setTimeout(() => setStatusMsg(""), 5000);
    return () => clearTimeout(t);
  }, [statusMsg]);

  const [open, setOpen] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [users, setUsers] = useState<
    { id: number; firstName: string; lastName: string; email: string }[]
  >([]);
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [err, setErr] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const days = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const currentWeekMondayYMD = useMemo(
    () => ymdLocal(startOfWeekMonday(new Date())),
    []
  );

  async function loadWeek() {
    try {
      const res = await fetch(
        `/api/activities?from=${weekStartStr}&to=${weekEndStr}`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatusType("error");
        setStatusMsg(data?.error ?? "Greška pri učitavanju aktivnosti.");
        setActivities([]);
        return;
      }

      const items: Activity[] = (data?.activities ?? []).map((a: any) => ({
        ...a,
        date: a.date?.toString().slice(0, 10),
        startTime: a.startTime,
        endTime: a.endTime,
      }));

      setActivities(items);
    } catch {
      setStatusType("error");
      setStatusMsg("Greška pri učitavanju aktivnosti.");
      setActivities([]);
    }
  }
  async function fetchHolidaysYear(year: number): Promise<Holiday[]> {
    try {
      const from = startOfYearYMD(year);
      const to = endOfYearYMD(year);

      const res = await fetch(
        `/api/holidays?from=${from}&to=${to}&country=RS`,
        { credentials: "include" }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) return [];

      return (data?.holidays ?? []) as Holiday[];
    } catch {
      return [];
    }
  }

  async function loadUsers() {
    if (!canEditActivities) return;

    try {
      const res = await fetch("/api/users", { credentials: "include" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatusType("error");
        setStatusMsg(data?.error ?? "Greška pri učitavanju korisnika.");
        setUsers([]);
        return;
      }

      const loaded = data?.users ?? [];
      setUsers(loaded);

      if (!exportUserId && loaded.length > 0) {
        setExportUserId(String(loaded[0].id));
      }
    } catch {
      setStatusType("error");
      setStatusMsg("Greška pri učitavanju korisnika.");
      setUsers([]);
    }
  }
  async function loadWeatherWeek() {
    try {
      const res = await fetch(
        `/api/weather?from=${weekStartStr}&to=${weekEndStr}`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setWeather([]);
        return;
      }

      setWeather((data ?? []) as WeatherDay[]);
    } catch {
      setWeather([]);
    }
  }
  function truncateDescription(text: string, maxLength = 100): string {
    const firstSentence = text.match(/^.*?[.!?](?:\s|$)/);
    if (firstSentence && firstSentence[0].length <= maxLength + 40) {
      return firstSentence[0].trim() + "…";
    }
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + "…";
  }

  const yearStart = weekStart.getFullYear();
  const yearEnd = addDays(weekStart, 4).getFullYear();

  useEffect(() => {
    (async () => {
      const h1 = await fetchHolidaysYear(yearStart);
      const h2 = yearEnd !== yearStart ? await fetchHolidaysYear(yearEnd) : [];
      setHolidays(mergeUniqueHolidays(h1, h2));
    })();
  }, [yearStart, yearEnd]);

  useEffect(() => {
    loadWeek();
    loadWeatherWeek();
  }, [weekStartStr, weekEndStr]);

  useEffect(() => {
    loadUsers();
  }, [canEditActivities]);

  const activitiesByDate = useMemo(() => {
    const map: Record<string, Activity[]> = {};
    for (const a of activities) {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    }
    for (const k of Object.keys(map)) {
      map[k].sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    }
    return map;
  }, [activities]);

  const holidayByDate = useMemo(() => {
    const m: Record<string, string> = {};
    for (const h of holidays) m[h.date] = h.name;
    return m;
  }, [holidays]);
  const weatherByDate = useMemo(() => {
    const m: Record<string, WeatherDay> = {};
    for (const w of weather) m[w.date] = w;
    return m;
  }, [weather]);

  function holidayLabel(dateStr: string) {
    const name = holidayByDate[dateStr];
    return name ? `Neradni dan (${name})` : null;
  }
  function openWfhModal(defaultDate?: string) {
    setWfhErr("");
    setWfhReason("");
    setWfhDate(defaultDate ?? weekStartStr);
    setWfhOpen(true);
  }

  async function submitWfhRequest() {
    setWfhErr("");

    if (!wfhDate) {
      setWfhErr("Datum je obavezan.");
      return;
    }
    if (!isValidISODateYYYYMMDD(wfhDate)) {
      setWfhErr("Datum mora biti validan i u formatu YYYY-MM-DD.");
      return;
    }

    const hLabel = holidayLabel(wfhDate);
    if (hLabel) {
      setWfhErr(hLabel);
      return;
    }

    setWfhBusy(true);
    try {
      const res = await fetch("/api/wfh-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: wfhDate,
          reason: wfhReason.trim() ? wfhReason.trim() : null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setWfhErr(data?.error ?? "Greška pri slanju WFH zahteva.");
        return;
      }

      setWfhOpen(false);
      setStatusType("info");
      setStatusMsg("WFH zahtev je poslat (ili ažuriran).");
    } finally {
      setWfhBusy(false);
    }
  }

  function openAddModal(defaultDate?: string) {
    setEditingId(null);
    const d = defaultDate ?? weekStartStr;
    setFormDate(d);
    setUserId("");
    setTitle("");
    setDescription("");
    setStart("09:00");
    setEnd("10:00");
    setErr("");
    setOpen(true);
  }

  function openEditModal(a: Activity) {
    setEditingId(a.id);
    setFormDate(a.date);
    setUserId(String(a.user.id));
    setTitle(a.name);
    setDescription(a.description ?? "");
    setStart(isoToHHMM(a.startTime));
    setEnd(isoToHHMM(a.endTime));
    setErr("");
    setOpen(true);
  }

  function validateForm() {
    if (canEditActivities && !userId) return "Moraš da izabereš korisnika.";
    if (!formDate) return "Datum je obavezan.";
    if (!isValidISODateYYYYMMDD(formDate))
      return "Datum mora biti validan i u formatu YYYY-MM-DD.";
    if (!title.trim()) return "Naziv aktivnosti je obavezan.";
    if (!isValidTimeHHMM(start) || !isValidTimeHHMM(end))
      return "Vreme mora biti u formatu HH:mm.";
    if (timeToMinutes(start) >= timeToMinutes(end))
      return "Početak mora biti pre kraja.";
    const hLabel = holidayLabel(formDate);
    if (hLabel) return hLabel;

    return "";
  }

  async function handleSave() {
    const msg = validateForm();
    if (msg) {
      setErr(msg);
      return;
    }
    setBusy(true);
    setErr("");

    const startDateObj = new Date(`${formDate}T${start}:00`);
    const endDateObj = new Date(`${formDate}T${end}:00`);

    const startISO = safeToISOString(startDateObj);
    const endISO = safeToISOString(endDateObj);

    if (!startISO || !endISO) {
      setErr("Datum/vreme nije validno. Proveri unos.");
      return;
    }

    try {
      if (editingId) {
        const res = await fetch(`/api/activities/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: title.trim(),
            description: description.trim() ? description.trim() : null,
            date: formDate,
            startTime: startISO,
            endTime: endISO,
            userId: userId ? Number(userId) : undefined,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setErr(data?.error ?? "Update failed");
          return;
        }
      } else {
        const res = await fetch(`/api/activities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: title.trim(),
            description: description.trim() ? description.trim() : null,
            date: formDate,
            startTime: startISO,
            endTime: endISO,
            userId: userId ? Number(userId) : undefined,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setErr(data?.error ?? "Greska");
          return;
        }
      }

      setOpen(false);
      setStatusType("info");
      setStatusMsg(editingId ? "Aktivnost izmenjena." : "Aktivnost dodata.");

      await loadWeek();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/activities/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatusType("error");
        setStatusMsg(data?.error ?? "Greška pri brisanju aktivnosti.");
        return;
      }

      setStatusType("info");
      setStatusMsg("Aktivnost obrisana.");
      await loadWeek();
    } finally {
      setBusy(false);
    }
  }

  async function handleExportICS() {
    try {
      setExportBusy(true);

      let url = `/api/activities/ics?from=${weekStartStr}&to=${weekEndStr}`;

      //samo admin i manager smeju da biraju drugog korisnika
      if (canEditActivities && exportUserId) {
        url += `&userId=${encodeURIComponent(exportUserId)}`;
      }

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatusType("error");
        setStatusMsg(data?.error ?? "Greška pri exportu .ics fajla.");
        return;
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = objectUrl;

      const suffix =
        canEditActivities && exportUserId ? `_user${exportUserId}` : "";
      a.download = `calendar_${weekStartStr}_${weekEndStr}${suffix}.ics`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(objectUrl);

      setStatusType("info");
      setStatusMsg("ICS fajl je preuzet.");
    } catch {
      setStatusType("error");
      setStatusMsg("Greška pri exportu .ics fajla.");
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <main>
      <h1 className="h1" style={{ fontSize: 28, marginBottom: 6 }}>
        Kalendar Aktivnosti
      </h1>
      <p className="h2" style={{ marginBottom: 24, fontSize: 16 }}>
        Pregled aktivnosti tokom radne nedelje (pon–pet).
      </p>

      <div className="weekHeader" style={{ marginTop: 24 }}>
        <div className="row" style={{ flex: 1, flexWrap: "wrap" }}>
          <Button onClick={() => setWeekStart(addDays(weekStart, -7))}>
            Prošla ned.
          </Button>
          <Button onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
            Trenutna ned.
          </Button>
          <Button onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Sledeca ned.
          </Button>

          {canEditActivities ? (
            <span title={holidayLabel(weekStartStr) ?? "Dodaj aktivnost"}>
              <Button
                onClick={() => openAddModal()}
                disabled={Boolean(holidayByDate[weekStartStr])}
              >
                + Dodaj aktivnost
              </Button>
            </span>
          ) : null}

          {isEmployee ? (
            <div style={{ marginLeft: "auto" }}>
              <Button onClick={() => openWfhModal()}>Pošalji WFH zahtev</Button>
            </div>
          ) : null}
        </div>

        <span
          className="pill"
          role="button"
          tabIndex={0}
          onClick={() => setWeekPickerOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setWeekPickerOpen(true);
          }}
          style={{ cursor: "pointer" }}
          title="Klikni da izabereš nedelju"
        >
          Nedelja: <strong>{weekStartStr}</strong> →{" "}
          <strong>{weekEndStr}</strong>
        </span>
      </div>
      {statusMsg ? (
        <div
          className={`notice ${statusType === "error" ? "notice-error" : ""} ${
            statusType === "info" ? "notice-success" : ""
          }`}
          style={
            statusType === "info"
              ? { marginTop: 16, marginBottom: 0 }
              : undefined
          }
        >
          {statusMsg}
        </div>
      ) : null}
      {wfhHint && isEmployee ? (
        <div className="notice" style={{ marginTop: 10 }}>
          {wfhHint}
        </div>
      ) : null}

      <div className="weekGrid">
        {days.map((d, idx) => {
          const dateStr = toISODate(d);
          const list = activitiesByDate[dateStr] ?? [];

          const holidayName = holidayByDate[dateStr];
          const isHoliday = Boolean(holidayName);

          return (
            <section
              key={dateStr}
              className="dayCol"
              style={
                isHoliday
                  ? {
                      background: "#e5e7eb",
                      border: "1px solid #d1d5db",
                      position: "relative",
                      padding: 20,
                      minHeight: 280,
                    }
                  : {
                      border: "2px solid #d7dbe2",
                      boxShadow: "0 4px 20px rgba(15, 23, 42, 0.08)",
                      padding: 20,
                      minHeight: 280,
                    }
              }
            >
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div
                  className="dayTitle"
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: "2px solid #e5e7eb",
                  }}
                >
                  {dayNames[idx]} <span className="muted">({dateStr})</span>
                </div>

                {/* WEATHER badge*/}
                {(() => {
                  const w = weatherByDate[dateStr];
                  if (!w) {
                    return (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: isHoliday
                            ? "rgba(0,0,0,0.06)"
                            : "rgba(255,255,255,0.04)",
                          border: isHoliday
                            ? "1px solid #d1d5db"
                            : "1px solid rgba(255,255,255,0.10)",
                          fontSize: 12,
                          whiteSpace: "nowrap",
                          opacity: isHoliday ? 1 : 0.7,
                        }}
                        title="Nema vremenskih podataka u bazi za ovaj dan (nije sync-ovano)."
                      >
                        <span className="muted">Weather: —</span>
                      </div>
                    );
                  }

                  const H = w.tempMax == null ? "?" : Math.round(w.tempMax);
                  const L = w.tempMin == null ? "?" : Math.round(w.tempMin);

                  return (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 6px",
                        borderRadius: 999,
                        background: isHoliday
                          ? "rgba(0,0,0,0.06)"
                          : "rgba(255,255,255,0.06)",
                        border: isHoliday
                          ? "1px solid #d1d5db"
                          : "1px solid rgba(255,255,255,0.12)",
                        fontSize: 13,
                        whiteSpace: "nowrap",
                        marginTop: 0,
                      }}
                      title={`Padavine: ${w.precipSum ?? "?"}mm | Vetar: ${
                        w.windMax ?? "?"
                      }`}
                    >
                      <img
                        src={getWeatherIcon(w.weatherCode)}
                        alt="weather"
                        style={{ width: 18, height: 18, opacity: 0.9 }}
                      />
                      <span>
                        H: <strong>{H}</strong>°
                      </span>
                      <span style={{ opacity: 0.7 }}>|</span>
                      <span>
                        L: <strong>{L}</strong>°
                      </span>
                    </div>
                  );
                })()}
                {isHoliday ? (
                  <div
                    style={{
                      marginTop: 8,
                      marginBottom: 10,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        color: "#374151",
                        fontSize: 12,
                        fontWeight: 600,
                        background: "rgba(255,255,255,0.8)",
                        border: "1px solid #d1d5db",
                        padding: "6px 10px",
                        borderRadius: 999,
                        textAlign: "center",
                        maxWidth: "100%",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={`Neradni dan (${holidayName})`}
                    >
                      Neradni dan ({holidayName})
                    </div>
                  </div>
                ) : null}
              </div>

              {canEditActivities ? (
                <span title={holidayLabel(dateStr) ?? "Dodaj aktivnost"}>
                  <Button
                    onClick={() => openAddModal(dateStr)}
                    disabled={Boolean(holidayByDate[dateStr])}
                  >
                    +
                  </Button>
                </span>
              ) : null}

              {list.length === 0 ? (
                <div className="muted" style={{ padding: 12 }}>
                  Nema aktivnosti.
                </div>
              ) : (
                list.map((a) => (
                  <div
                    key={a.id}
                    className="eventCard"
                    title={a.description ?? undefined}
                    style={{
                      padding: 14,
                      marginTop: 12,
                      border: "1px solid #d7dbe2",
                      borderRadius: 12,
                      boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
                      cursor: a.description ? "help" : undefined,
                    }}
                  >
                    <p className="eventTitle">{a.name}</p>

                    <div className="eventTime">
                      {isoToHHMM(a.startTime)} – {isoToHHMM(a.endTime)}
                    </div>

                    {a.description ? (
                      <div
                        className="muted"
                        style={{ fontSize: 12, marginTop: 6, lineHeight: 1.4 }}
                      >
                        {truncateDescription(a.description)}
                        {a.descriptionSource === "AI" ? (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 999,
                              background: "#eef2ff",
                              color: "#4338ca",
                              fontWeight: 700,
                              verticalAlign: "middle",
                            }}
                            title="Opis je generisan pomoću AI-ja"
                          >
                            AI
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {canEditActivities ? (
                      <div className="muted" style={{ fontSize: 12 }}>
                        Korisnik: <strong>{ownerLabel(a.user)}</strong>{" "}
                      </div>
                    ) : null}

                    {canEditActivities ? (
                      <div
                        className="modalActions"
                        style={{ justifyContent: "flex-start" }}
                      >
                        <Button onClick={() => openEditModal(a)}>Izmeni</Button>
                        <Button
                          disabled={busy}
                          onClick={() => handleDelete(a.id)}
                        >
                          Obriši
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </section>
          );
        })}
      </div>

      <div
        className="row"
        style={{ justifyContent: "space-between", marginTop: 16 }}
      >
        <span className="pill">
          Export: <strong>{weekStartStr}</strong> →{" "}
          <strong>{weekEndStr}</strong>
        </span>

        <div className="row" style={{ gap: 10 }}>
          {canEditActivities ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="muted" style={{ fontSize: 13 }}>
                Izaberi korisnika:
              </span>

              <select
                className="select"
                value={exportUserId}
                onChange={(e) => setExportUserId(e.target.value)}
                disabled={users.length === 0}
                style={{ minWidth: 160 }}
              >
                {users.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {!canEditActivities ? (
            <span className="muted" style={{ fontSize: 13 }}>
              Exportuješ svoj kalendar
            </span>
          ) : null}

          <Button
            disabled={exportBusy || (canEditActivities && !exportUserId)}
            onClick={handleExportICS}
          >
            {exportBusy ? "Exporting..." : "Export .ics"}
          </Button>
        </div>
      </div>

      <Modal
        open={open}
        title={editingId ? "Izmeni aktivnost" : "Dodaj aktivnost"}
        onClose={() => setOpen(false)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <TextField
            label="Datum (YYYY-MM-DD)"
            value={formDate}
            onChange={setFormDate}
            placeholder="2026-01-27"
          />
          {canEditActivities ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13 }} className="muted">
                Korisnik
              </label>

              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="select"
              >
                {users.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.firstName} {u.lastName} — {u.email}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <TextField
            label="Naziv"
            value={title}
            onChange={setTitle}
            placeholder="npr. Nastava / Sastanak"
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13 }} className="muted">
              Opis (opciono)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ostavi prazno da AI sam generiše opis na osnovu naziva"
              rows={4}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #d7dbe2",
                fontSize: 14,
                fontFamily: "inherit",
                lineHeight: 1.5,
                resize: "vertical",
              }}
            />
          </div>

          <div className="row">
            <div style={{ flex: 1 }}>
              <TextField
                label="Početak (HH:mm)"
                value={start}
                onChange={setStart}
                placeholder="09:00"
              />
            </div>
            <div style={{ flex: 1 }}>
              <TextField
                label="Kraj (HH:mm)"
                value={end}
                onChange={setEnd}
                placeholder="10:00"
              />
            </div>
          </div>

          {err ? (
            <div style={{ color: "#ff6b6b", fontSize: 13 }}>{err}</div>
          ) : null}

          <div className="hr" />

          <div className="modalActions" style={{ marginTop: 20 }}>
            <Button disabled={busy} onClick={() => setOpen(false)}>
              Poništi
            </Button>
            <Button variant="primary" disabled={busy} onClick={handleSave}>
              Sačuvaj
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={weekPickerOpen}
        title={`Izaberi nedelju (${weekStart.getFullYear()})`}
        onClose={() => setWeekPickerOpen(false)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="muted" style={{ fontSize: 13 }}>
            Levo od svake nedelje je strelica. Klikni strelicu da izabereš
            nedelju (pon–pet).
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
              gap: 12,
              maxHeight: 520,
              overflowY: "auto",
              paddingRight: 6,
            }}
          >
            {Array.from({ length: 12 }, (_, month0) => {
              const year = weekStart.getFullYear();
              const monthName = new Date(year, month0, 1).toLocaleString(
                "sr-Latn-RS",
                {
                  month: "long",
                }
              );

              const weeks = buildMonthWeeks(year, month0);

              return (
                <div key={month0} className="weekPickerMonth">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ fontSize: 14 }}>
                      <strong style={{ textTransform: "capitalize" }}>
                        {monthName}
                      </strong>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {year}
                    </div>
                  </div>

                  {/* header Pon–Ned */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "34px repeat(7, 1fr)",
                      gap: 4,
                      marginTop: 8,
                      alignItems: "center",
                    }}
                  >
                    <div />
                    {weekDayNames.map((n) => (
                      <div
                        key={n}
                        className="muted"
                        style={{ fontSize: 11, textAlign: "center" }}
                      >
                        {n}
                      </div>
                    ))}
                  </div>

                  {/* week rows */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      marginTop: 6,
                    }}
                  >
                    {weeks.map((weekDays) => {
                      const monday = startOfWeekMondayLocal(weekDays[0]); // već je pon
                      const mondayYMD = ymdLocal(monday);
                      const isSelected = isSameYMD(mondayYMD, weekStartStr);
                      const isHover = hoverWeekStart === mondayYMD;

                      return (
                        <div
                          key={mondayYMD}
                          className="weekPickerWeekRow"
                          style={{
                            background: isSelected
                              ? "rgba(79, 70, 229, 0.08)"
                              : mondayYMD === currentWeekMondayYMD
                              ? "rgba(0, 0, 0, 0.05)"
                              : isHover
                              ? "rgba(236, 239, 243, 0.8)"
                              : "transparent",
                            border: isSelected
                              ? "1px solid rgba(79, 70, 229, 0.3)"
                              : "1px solid transparent",
                          }}
                          onMouseEnter={() => setHoverWeekStart(mondayYMD)}
                          onMouseLeave={() => setHoverWeekStart(null)}
                        >
                          {/* Arrow */}
                          <button
                            type="button"
                            className="weekPickerSelectBtn"
                            style={{
                              background: isSelected
                                ? "rgba(79, 70, 229, 0.15)"
                                : "transparent",
                              borderColor: isSelected
                                ? "rgba(79, 70, 229, 0.4)"
                                : undefined,
                            }}
                            onClick={() => {
                              setWeekStart(monday);
                              setWeekPickerOpen(false);
                            }}
                            aria-label={`Izaberi nedelju od ${mondayYMD}`}
                            title={`Izaberi nedelju (${mondayYMD})`}
                          >
                            →
                          </button>

                          {/* Days */}
                          {weekDays.map((d) => {
                            const dayYMD = ymdLocal(d);
                            const inMonth = d.getMonth() === month0;
                            const isWorkSelected =
                              isSelected &&
                              dayYMD >= weekStartStr &&
                              dayYMD <= weekEndStr;
                            const isWorkHover = hoverWeekStart
                              ? isInWorkWeekRange(dayYMD, hoverWeekStart)
                              : false;
                            const isHolidayDot = Boolean(holidayByDate[dayYMD]);

                            return (
                              <div
                                key={dayYMD}
                                style={{
                                  position: "relative",
                                  height: 28,
                                  borderRadius: 8,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 12,
                                  opacity: inMonth ? 1 : 0.35,
                                  background: isWorkSelected
                                    ? "rgba(79, 70, 229, 0.12)"
                                    : isWorkHover
                                    ? "rgba(236, 239, 243, 0.9)"
                                    : "rgba(246, 247, 249, 0.5)",
                                  border: isWorkSelected
                                    ? "1px solid rgba(79, 70, 229, 0.35)"
                                    : "1px solid transparent",
                                }}
                              >
                                {d.getDate()}
                                {isHolidayDot ? (
                                  <span
                                    style={{
                                      position: "absolute",
                                      top: 4,
                                      right: 5,
                                      width: 6,
                                      height: 6,
                                      borderRadius: 999,
                                      background: "#ff3b30",
                                    }}
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="modalActions">
            <Button onClick={() => setWeekPickerOpen(false)}>Zatvori</Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={wfhOpen}
        title="WFH zahtev"
        onClose={() => setWfhOpen(false)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <TextField
            label="Datum (YYYY-MM-DD)"
            value={wfhDate}
            onChange={setWfhDate}
            placeholder="2026-02-15"
          />

          <TextField
            label="Dodatni razlog (opciono)"
            value={wfhReason}
            onChange={setWfhReason}
            placeholder="npr. zdravstveni razlog / nemogućnost dolaska / logistika"
          />

          {wfhErr ? (
            <div style={{ color: "#ff6b6b", fontSize: 13 }}>{wfhErr}</div>
          ) : null}

          <div className="hr" />

          <div className="modalActions" style={{ marginTop: 20 }}>
            <Button disabled={wfhBusy} onClick={() => setWfhOpen(false)}>
              Poništi
            </Button>
            <Button
              variant="primary"
              disabled={wfhBusy}
              onClick={submitWfhRequest}
            >
              {wfhBusy ? "Slanje..." : "Pošalji"}
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
