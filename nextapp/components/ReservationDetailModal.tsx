"use client";

import { Modal } from "@/components/ui/Modal";
import { EquipmentChip } from "@/components/ui/Badges";
import { fmtDateLong, fmtRange, toTimeStr } from "@/lib/datetime";
import { splitPurpose, type ApiReservation } from "@/lib/types";

export function ReservationDetailModal({
  reservation,
  canManage,
  onClose,
  onEdit,
  onCancel,
}: {
  reservation: ApiReservation;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const { event, purpose } = splitPurpose(reservation.purpose);
  const start = new Date(reservation.startDateTime);
  const end = new Date(reservation.endDateTime);
  const dateStr = start.toISOString().slice(0, 10);

  return (
    <Modal
      title={event || "Reservation"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {canManage && reservation.status === "CONFIRMED" && (
            <>
              <button className="btn btn-danger" onClick={onCancel}>Cancel reservation</button>
              <button className="btn btn-primary" onClick={onEdit}>Edit</button>
            </>
          )}
        </>
      }
    >
      <div className="summary">
        <div className="srow"><dt>Status</dt><dd>{reservation.status === "CONFIRMED" ? <span className="badge badge-ok">Confirmed</span> : <span className="badge badge-off">Cancelled</span>}</dd></div>
        <div className="srow"><dt>Date</dt><dd>{fmtDateLong(dateStr)}</dd></div>
        <div className="srow"><dt>Time</dt><dd>{fmtRange(toTimeStr(start), toTimeStr(end))}</dd></div>
        <div className="srow"><dt>Equipment</dt><dd>{reservation.equipment.map((e) => <EquipmentChip key={e.equipmentId} name={e.equipment.name} type={e.equipment.type} />)}</dd></div>
        <div className="srow"><dt>Room</dt><dd>{reservation.room.name}</dd></div>
        <div className="srow"><dt>Activity</dt><dd>{event}</dd></div>
        {purpose && <div className="srow"><dt>Purpose</dt><dd>{purpose}</dd></div>}
        {reservation.notes && <div className="srow"><dt>Notes</dt><dd>{reservation.notes}</dd></div>}
        <div className="srow"><dt>Reserved by</dt><dd>{reservation.user.name}</dd></div>
      </div>
      {!canManage && <p className="hint" style={{ marginTop: 12 }}>Only the teacher who booked this, or an administrator, can change it.</p>}
    </Modal>
  );
}
