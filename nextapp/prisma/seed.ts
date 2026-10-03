/**
 * Seeds the database with realistic demo data so the app is immediately
 * usable: five accounts (one admin, four teachers — all sharing the
 * passwords printed below), nine equipment items across every type, eight
 * rooms, and a spread of reservations across the next couple of weeks so
 * the calendar isn't empty the first time anyone opens it.
 *
 * Run with: npm run db:seed  (safe to re-run — it clears and reseeds).
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { combineDateTime, addDaysStr, todayStr } from "../lib/datetime";

const prisma = new PrismaClient();

const ROOMS: [string, string, number][] = [
  ["Room 101", "Main Building", 40], ["Room 102", "Main Building", 40],
  ["Room 201", "Main Building", 45], ["Room 202", "Main Building", 45],
  ["Room 204", "Main Building", 45], ["Computer Laboratory", "Annex", 30],
  ["Science Laboratory", "Annex", 32], ["Auditorium", "Arts Building", 350],
];

const EQUIPMENT: [string, string, string, string, string, string][] = [
  // name, type, status, location, condition, description
  ["Projector 01", "PROJECTOR", "AVAILABLE", "Equipment Room", "Good", "Epson EB-X51, 3800 lumens, HDMI + VGA"],
  ["Projector 02", "PROJECTOR", "AVAILABLE", "Equipment Room", "Good", "Epson EB-X51, 3800 lumens, HDMI + VGA"],
  ["Projector 03", "PROJECTOR", "MAINTENANCE", "Equipment Room", "Lamp replacement due", "Lamp at end of life — booked out until serviced"],
  ["Microphone 01", "MICROPHONE", "AVAILABLE", "Equipment Room", "Good", "Shure SM58 wired, 6m cable"],
  ["Microphone 02", "MICROPHONE", "AVAILABLE", "AV Storage", "Good", "Wireless handheld, 2 spare batteries"],
  ["Speaker 01", "SPEAKER", "AVAILABLE", "Equipment Room", "Good", 'Powered 12" PA speaker with stand'],
  ["Speaker 02", "SPEAKER", "AVAILABLE", "AV Storage", "Fair", "Portable battery PA, slight cabinet scuff"],
  ["Laptop 01", "LAPTOP", "AVAILABLE", "ICT Office", "Good", "Windows 11, HDMI adapter included"],
  ["Laptop 02", "LAPTOP", "AVAILABLE", "ICT Office", "Good", "Windows 11, HDMI adapter included"],
];

const USERS: [string, string, "ADMIN" | "TEACHER", string][] = [
  ["Ana Reyes", "admin@school.edu", "ADMIN", "admin123"],
  ["Mr. Santos", "santos@school.edu", "TEACHER", "teacher123"],
  ["Ms. Cruz", "cruz@school.edu", "TEACHER", "teacher123"],
  ["Mr. Garcia", "garcia@school.edu", "TEACHER", "teacher123"],
  ["Ms. Villanueva", "villanueva@school.edu", "TEACHER", "teacher123"],
];

async function main() {
  console.log("Clearing existing data…");
  await prisma.reservationEquipment.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();

  console.log("Creating accounts…");
  const users: Record<string, string> = {};
  for (const [name, email, role, password] of USERS) {
    const u = await prisma.user.create({ data: { name, email, role, status: "ACTIVE", passwordHash: await hashPassword(password) } });
    users[email] = u.id;
  }

  console.log("Creating rooms…");
  const rooms: Record<string, string> = {};
  for (const [name, building, capacity] of ROOMS) {
    const r = await prisma.room.create({ data: { name, building, capacity, status: "AVAILABLE" } });
    rooms[name] = r.id;
  }

  console.log("Creating equipment…");
  const equipment: Record<string, string> = {};
  for (const [name, type, status, location, condition, description] of EQUIPMENT) {
    const e = await prisma.equipment.create({
      data: { name, type: type as any, status: status as any, location, condition, description },
    });
    equipment[name] = e.id;
  }

  console.log("Creating sample reservations…");
  const today = todayStr();
  const plan: [number, string, string, string[], string, string, string, string][] = [
    // dayOffset, start, end, equipmentNames, roomName, userEmail, activity, purpose
    [0, "09:00", "11:00", ["Projector 01"], "Room 204", "santos@school.edu", "Grade 9 Science presentation", "Class presentation"],
    [0, "10:00", "12:00", ["Speaker 01", "Microphone 02"], "Auditorium", "cruz@school.edu", "Student assembly rehearsal", "School programme"],
    [0, "13:00", "15:00", ["Projector 02", "Microphone 01"], "Room 101", "garcia@school.edu", "Parent-teacher orientation", "Meeting"],
    [1, "08:00", "09:30", ["Laptop 01", "Projector 01"], "Computer Laboratory", "villanueva@school.edu", "ICT practical exam", "Assessment"],
    [1, "14:00", "16:00", ["Speaker 02"], "Auditorium", "cruz@school.edu", "Intramurals briefing", "Sports"],
    [2, "09:00", "10:30", ["Projector 02"], "Science Laboratory", "garcia@school.edu", "Chemistry demonstration", "Laboratory class"],
    [2, "13:30", "15:30", ["Microphone 01", "Speaker 01"], "Auditorium", "santos@school.edu", "Speech choir practice", "Co-curricular"],
    [4, "08:30", "10:00", ["Projector 01", "Laptop 01"], "Room 201", "santos@school.edu", "Research defense panel", "Assessment"],
    [7, "13:00", "14:30", ["Projector 02", "Microphone 01"], "Room 102", "garcia@school.edu", "Guest lecture on robotics", "Seminar"],
    [8, "09:00", "10:30", ["Laptop 02", "Projector 01"], "Computer Laboratory", "villanueva@school.edu", "Coding club workshop", "Club activity"],
  ];

  for (const [offset, start, end, equipNames, roomName, userEmail, event, purpose] of plan) {
    const date = addDaysStr(today, offset);
    await prisma.reservation.create({
      data: {
        userId: users[userEmail],
        roomId: rooms[roomName],
        startDateTime: combineDateTime(date, start),
        endDateTime: combineDateTime(date, end),
        purpose: `${event} \u2014 ${purpose}`,
        status: "CONFIRMED",
        equipment: { create: equipNames.map((n) => ({ equipmentId: equipment[n] })) },
      },
    });
  }

  console.log("\nSeed complete. Demo accounts (same password for all teachers):\n");
  console.log("  Administrator  admin@school.edu       admin123");
  console.log("  Teacher        santos@school.edu      teacher123");
  console.log("  Teacher        cruz@school.edu        teacher123");
  console.log("  Teacher        garcia@school.edu      teacher123");
  console.log("  Teacher        villanueva@school.edu  teacher123\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
