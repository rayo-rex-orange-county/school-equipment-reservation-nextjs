"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ToastProvider";
import { EQUIPMENT_TYPES, EQUIPMENT_COLORS } from "@/lib/constants";
import { addDaysStr, fmtDate, fmtDateLong, fmtRange, fmtTime, todayStr, toDateStr, toTimeStr, overlaps as overlapsDates, combineDateTime } from "@/lib/datetime";
import { splitPurpose, type ApiEquipment, type ApiReservation, type ApiRoom } from "@/lib/types";

const STEPS = ["Date", "Time", "Equipment", "Room", "Details", "Confirm"];
const MIN_MINUTES = 15;

type Draft = {
  date: string; start: string; end: string;
  equipmentIds: string[]; roomId: string;
  event: string; purpose: string; notes: string;
};

function overlapsSlot(aStart: string, aEnd: string, date: string, bStartISO: string, bEndISO: string) {
  const a0 = combineDateTime(date, aStart), a1 = combineDateTime(date, aEnd);
  return overlapsDates(a0, a1, new Date(bStartISO), new Date(bEndISO));
}

type Seed = { equipmentId: string; date?: string; start?: string; end?: string } | null;

export function ReserveWizard({
  editId,
  currentUserId,
  seed,
}: {
  editId: string | null;
  currentUserId: string;
  seed?: Seed;
}) {
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<ApiEquipment[]>([]);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [reservations, setReservations] = useState<ApiReservation[]>([]);
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState("");
  const [conflicts, setConflicts] = useState<{ message: string }[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    date: todayStr(), start: "09:00", end: "10:00",
    equipmentIds: [], roomId: "", event: "", purpose: "", notes: "",
  });

  useEffect(() => {
    (async () => {
      const [eq, rm, res] = await Promise.all([
        api.get("/api/equipment"), api.get("/api/rooms"), api.get("/api/reservations"),
      ]);
      setEquipment(eq.equipment); setRooms(rm.rooms); setReservations(res.reservations);
      if (editId) {
        const existing: ApiReservation | undefined = res.reservations.find((r: ApiReservation) => r.id === editId);
        if (existing) {
          const { event, purpose } = splitPurpose(existing.purpose);
          const start = new Date(existing.startDateTime), end = new Date(existing.endDateTime);
          setDraft({
            date: toDateStr(start), start: toTimeStr(start), end: toTimeStr(end),
            equipmentIds: existing.equipment.map((e) => e.equipmentId), roomId: existing.roomId,
            event, purpose, notes: existing.notes || "",
          });
        }
      } else if (seed) {
        setDraft((d) => ({
          ...d,
          date: seed.date || d.date, start: seed.start || d.start, end: seed.end || d.end,
          equipmentIds: [seed.equipmentId],
        }));
        setStep(3);
      }
      setLoading(false);
    })();
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = useMemo(() => reservations.filter((r) => r.status === "CONFIRMED" && r.id !== editId), [reservations, editId]);

  function equipmentBooking(equipId: string, date: string, start: string, end: string) {
    return active.find((r) =>
      r.equipment.some((e) => e.equipmentId === equipId) &&
      overlapsSlot(start, end, date, r.startDateTime, r.endDateTime)) || null;
  }
  function roomBooking(roomId: string, date: string, start: string, end: string) {
    return active.find((r) => r.roomId === roomId && overlapsSlot(start, end, date, r.startDateTime, r.endDateTime)) || null;
  }

  function prune(d: Draft): Draft {
    const equipmentIds = d.equipmentIds.filter((id) => {
      const e = equipment.find((x) => x.id === id);
      if (!e || e.status !== "AVAILABLE") return false;
      return !equipmentBooking(id, d.date, d.start, d.end);
    });
    let roomId = d.roomId;
    if (roomId && roomBooking(roomId, d.date, d.start, d.end)) roomId = "";
    return { ...d, equipmentIds, roomId };
  }

  function update(patch: Partial<Draft>) {
    setStepError("");
    setDraft((d) => {
      const next = { ...d, ...patch };
      return "date" in patch || "start" in patch || "end" in patch ? prune(next) : next;
    });
  }

  function validateStep(): string {
    if (step === 1) {
      if (!draft.date) return "Pick a date.";
      if (draft.date < todayStr()) return "That date has already passed.";
    }
    if (step === 2) {
      if (!draft.start || !draft.end) return "Set both a start and an end time.";
      const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
      if (mins(draft.end) <= mins(draft.start)) return "The end time must be after the start time.";
      if (mins(draft.end) - mins(draft.start) < MIN_MINUTES) return `Reserve the equipment for at least ${MIN_MINUTES} minutes.`;
    }
    if (step === 3 && !draft.equipmentIds.length) return "Select at least one piece of equipment.";
    if (step === 4 && !draft.roomId) return "Choose the room where the equipment will be used.";
    if (step === 5 && !draft.event.trim()) return "Give the activity a name so colleagues can see what the booking is for.";
    return "";
  }

  function next() {
    const msg = validateStep();
    setStepError(msg);
    if (msg) return;
    setConflicts(null);
    setStep((s) => Math.min(6, s + 1));
    window.scrollTo(0, 0);
  }
  function back() {
    setStepError(""); setConflicts(null);
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo(0, 0);
  }

  async function submit() {
    setSubmitting(true);
    setConflicts(null);
    try {
      const body = { date: draft.date, start: draft.start, end: draft.end, roomId: draft.roomId,
        equipmentIds: draft.equipmentIds, event: draft.event.trim(), purpose: draft.purpose.trim(), notes: draft.notes.trim() };
      const result = editId ? await api.patch(`/api/reservations/${editId}`, body) : await api.post("/api/reservations", body);
      const r: ApiReservation = result.reservation;
      toast(
        editId ? "Reservation updated" : "Reservation confirmed!",
        `${fmtDateLong(draft.date)}\n${fmtRange(draft.start, draft.end)}\n` +
          `${r.equipment.map((e) => e.equipment.name).join(" + ")}\n${r.room.name}`,
        "ok"
      );
      router.push("/mine");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.conflicts) {
        setConflicts(err.conflicts);
        toast("Cannot book that slot", err.conflicts[0].message, "bad");
      } else if (err instanceof ApiError) {
        setStep(1); setStepError(err.message);
        toast("Check the reservation", err.message, "bad");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="card card-pad"><p className="muted" style={{ margin: 0 }}>Loading availability…</p></div>;

  return (
    <div className="wiz">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <h1>{editId ? "Edit reservation" : "Make a reservation"}</h1>
          <p>{editId ? "Change the slot — the system re-checks for clashes before saving." : "Six quick steps. Nothing is booked until you confirm."}</p>
        </div>
      </div>

      <div className="steps">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <div key={label} className={`step ${n < step ? "done" : n === step ? "now" : ""}`}>
              <div className="bar" /><div className="t">{label}</div>
            </div>
          );
        })}
      </div>

      <div className="wiz-card">
        {stepError && <div className="conflict"><b>Check this step</b>{stepError}</div>}

        {step === 1 && (
          <>
            <h2>When do you need it?</h2>
            <p className="hint" style={{ marginBottom: 16 }}>Pick the day the equipment will be used.</p>
            <div className="picker" style={{ marginBottom: 16 }}>
              {[0, 1, 2, 3, 4].map((n) => {
                const iso = addDaysStr(todayStr(), n);
                return (
                  <button key={iso} className={`pick ${draft.date === iso ? "on" : ""}`} onClick={() => update({ date: iso })} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                    <span className="pk-name">{iso === todayStr() ? "Today" : n === 1 ? "Tomorrow" : fmtDate(iso).split(",")[0]}</span>
                    <span className="pk-meta">{fmtDate(iso)}</span>
                  </button>
                );
              })}
            </div>
            <div className="field">
              <label htmlFor="w-date">Or choose any date</label>
              <input className="inp" id="w-date" type="date" min={todayStr()} value={draft.date} onChange={(e) => update({ date: e.target.value })} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>What time?</h2>
            <p className="hint" style={{ marginBottom: 16 }}>{fmtDateLong(draft.date)}</p>
            <div className="picker" style={{ marginBottom: 16 }}>
              {[["07:30", "08:30"], ["08:00", "10:00"], ["09:00", "11:00"], ["10:00", "12:00"], ["13:00", "15:00"], ["14:00", "16:00"]].map(([s, e]) => (
                <button key={s + e} className={`pick ${draft.start === s && draft.end === e ? "on" : ""}`} style={{ justifyContent: "center" }} onClick={() => update({ start: s, end: e })}>
                  <span className="pk-name">{fmtRange(s, e)}</span>
                </button>
              ))}
            </div>
            <div className="row2">
              <div className="field"><label htmlFor="w-s">Start time</label><input className="inp" id="w-s" type="time" step={900} value={draft.start} onChange={(e) => update({ start: e.target.value })} /></div>
              <div className="field"><label htmlFor="w-e">End time</label><input className="inp" id="w-e" type="time" step={900} value={draft.end} onChange={(e) => update({ end: e.target.value })} /></div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2>Which equipment?</h2>
            <p className="hint" style={{ marginBottom: 16 }}>
              {fmtDate(draft.date)} · {fmtRange(draft.start, draft.end)} — anything already taken in this window is greyed out.
            </p>
            {EQUIPMENT_TYPES.map(({ value: type, label }) => {
              const items = equipment.filter((e) => e.type === type && e.status !== "RETIRED");
              if (!items.length) return null;
              return (
                <div key={type} style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 9, alignItems: "center" }}>
                    <span className="chip-dot" style={{ background: EQUIPMENT_COLORS[type].fg }} />
                    <b style={{ fontSize: 14 }}>{label}</b>
                  </div>
                  <div className="picker">
                    {items.map((e) => {
                      const booking = equipmentBooking(e.id, draft.date, draft.start, draft.end);
                      const blocked = e.status !== "AVAILABLE" || !!booking;
                      const on = draft.equipmentIds.includes(e.id);
                      let meta: string;
                      if (e.status !== "AVAILABLE") meta = `${e.status[0] + e.status.slice(1).toLowerCase()} · cannot be reserved`;
                      else if (booking) meta = `Taken ${fmtRange(toTimeStr(new Date(booking.startDateTime)), toTimeStr(new Date(booking.endDateTime)))} · ${booking.room.name}`;
                      else meta = `Free · kept in ${e.location || "the equipment room"}`;
                      return (
                        <button key={e.id} className={`pick ${on ? "on" : ""}`} disabled={blocked}
                          onClick={() => update({ equipmentIds: on ? draft.equipmentIds.filter((x) => x !== e.id) : [...draft.equipmentIds, e.id] })}>
                          <span className="box">✓</span>
                          <span><span className="pk-name">{e.name}</span><span className="pk-meta">{meta}</span></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <p className="hint">
              {draft.equipmentIds.length
                ? `${draft.equipmentIds.length} selected: ${draft.equipmentIds.map((id) => equipment.find((e) => e.id === id)?.name).join(", ")}`
                : "Select one or more items. You can combine types, such as a speaker and a microphone."}
            </p>
          </>
        )}

        {step === 4 && (
          <>
            <h2>Where will it be used?</h2>
            <p className="hint" style={{ marginBottom: 16 }}>Rooms already booked for this window are greyed out.</p>
            <div className="picker">
              {rooms.map((r) => {
                const booking = roomBooking(r.id, draft.date, draft.start, draft.end);
                const blocked = r.status !== "AVAILABLE" || !!booking;
                const on = draft.roomId === r.id;
                let meta: string;
                if (r.status !== "AVAILABLE") meta = "Marked unavailable";
                else if (booking) meta = `In use ${fmtRange(toTimeStr(new Date(booking.startDateTime)), toTimeStr(new Date(booking.endDateTime)))} · ${booking.user.name}`;
                else meta = [r.building, r.capacity ? `seats ${r.capacity}` : ""].filter(Boolean).join(" · ");
                return (
                  <button key={r.id} className={`pick ${on ? "on" : ""}`} disabled={blocked} onClick={() => update({ roomId: r.id })}>
                    <span className="box">✓</span>
                    <span><span className="pk-name">{r.name}</span><span className="pk-meta">{meta}</span></span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h2>What is it for?</h2>
            <p className="hint" style={{ marginBottom: 16 }}>This is what colleagues and the equipment desk will see on the calendar.</p>
            <div className="field"><label htmlFor="w-ev">Activity name</label>
              <input className="inp" id="w-ev" autoFocus value={draft.event} onChange={(e) => update({ event: e.target.value })} placeholder="Grade 9 Science presentation" /></div>
            <div className="field"><label htmlFor="w-pu">Purpose</label>
              <input className="inp" id="w-pu" value={draft.purpose} onChange={(e) => update({ purpose: e.target.value })} placeholder="Class presentation" /></div>
            <div className="field"><label htmlFor="w-no">Notes for the equipment desk <span className="muted" style={{ fontWeight: 500 }}>— optional</span></label>
              <textarea className="inp" id="w-no" value={draft.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="Please include an HDMI cable." /></div>
          </>
        )}

        {step === 6 && (
          <>
            <h2>{editId ? "Confirm your changes" : "Check and confirm"}</h2>
            <p className="hint" style={{ marginBottom: 16 }}>Nothing is reserved until you press the button below.</p>
            {conflicts && conflicts.length > 0 && (
              <div className="conflict"><b>This slot is no longer free</b><ul>{conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul></div>
            )}
            <dl className="summary">
              <div className="srow"><dt>Date</dt><dd>{fmtDateLong(draft.date)}</dd></div>
              <div className="srow"><dt>Time</dt><dd>{fmtRange(draft.start, draft.end)}</dd></div>
              <div className="srow"><dt>Equipment</dt><dd>{draft.equipmentIds.map((id) => equipment.find((e) => e.id === id)?.name).join(", ") || "—"}</dd></div>
              <div className="srow"><dt>Room</dt><dd>{rooms.find((r) => r.id === draft.roomId)?.name || "—"}</dd></div>
              <div className="srow"><dt>Activity</dt><dd>{draft.event || "—"}</dd></div>
              {draft.purpose && <div className="srow"><dt>Purpose</dt><dd>{draft.purpose}</dd></div>}
              {draft.notes && <div className="srow"><dt>Notes</dt><dd>{draft.notes}</dd></div>}
            </dl>
          </>
        )}

        <div className="wiz-foot">
          {step > 1
            ? <button className="btn btn-ghost" onClick={back}>Back</button>
            : <button className="btn btn-ghost" onClick={() => router.push(editId ? "/mine" : "/dashboard")}>Cancel</button>}
          <span style={{ flex: 1 }} />
          {step < 6
            ? <button className="btn btn-primary" onClick={next}>Continue</button>
            : <button className="btn btn-primary btn-lg" onClick={submit} disabled={submitting}>
                {submitting ? "Saving…" : editId ? "Save changes" : "Confirm reservation"}
              </button>}
        </div>
      </div>
    </div>
  );
}
