import bcrypt from "bcrypt";
import pool from "./db";

const SALT_ROUNDS = 10;

async function seedDatabase() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    console.log("Seeding data...");

    // ---------- Departments ----------
    const deptRes = await client.query<{ id: number; name: string }>(
      `INSERT INTO departments (name) VALUES
        ('General Operations'), ('Help Desk'), ('Software Engineering'), ('Infrastructure')
       RETURNING id, name`,
    );
    const dept = Object.fromEntries(deptRes.rows.map((d) => [d.name, d.id]));
    console.log("✓ Departments seeded.");

    // ---------- Ticket types ----------
    const typeRes = await client.query<{ id: number; key: string }>(
      `INSERT INTO ticket_types (key, label) VALUES
        ('hardware_prob', 'Hardware Problem'),
        ('software_prob', 'Software Problem'),
        ('network_prob', 'Network Problem')
       RETURNING id, key`,
    );
    const type = Object.fromEntries(typeRes.rows.map((t) => [t.key, t.id]));
    console.log("✓ Ticket types seeded.");

    // ---------- Pipelines ----------
    // hardware_prob:  Help Desk -> Infrastructure
    // software_prob:  Help Desk -> Software Engineering
    // network_prob:   Help Desk -> Software Engineering -> Infrastructure
    const pipelines: Record<number, number[]> = {
      [type.hardware_prob]: [dept["Help Desk"], dept["Infrastructure"]],
      [type.software_prob]: [dept["Help Desk"], dept["Software Engineering"]],
      [type.network_prob]: [
        dept["Help Desk"],
        dept["Software Engineering"],
        dept["Infrastructure"],
      ],
    };
    const pipelineInserts: [number, number, number][] = [];
    for (const [typeId, steps] of Object.entries(pipelines)) {
      steps.forEach((deptId, idx) =>
        pipelineInserts.push([Number(typeId), idx + 1, deptId]),
      );
    }
    for (const [ticket_type_id, step_order, department_id] of pipelineInserts) {
      await client.query(
        `INSERT INTO pipeline_steps (ticket_type_id, step_order, department_id) VALUES ($1, $2, $3)`,
        [ticket_type_id, step_order, department_id],
      );
    }
    console.log("✓ Pipelines seeded.");

    // ---------- Users (10 total: 2 end users, 8 dept members) ----------
    const defaultPasswordHash = await bcrypt.hash("password123", SALT_ROUNDS);

    const deptMemberSeed: [string, string, number][] = [
      ["Alice Nguyen", "alice@company.com", dept["Help Desk"]],
      ["Ben Cruz", "ben@company.com", dept["Help Desk"]],
      ["Carla Reyes", "carla@company.com", dept["Help Desk"]],
      ["Dave Santos", "dave@company.com", dept["Software Engineering"]],
      ["Elena Torres", "elena@company.com", dept["Software Engineering"]],
      ["Feye Lim", "feye@company.com", dept["Software Engineering"]],
      ["George Patel", "george@company.com", dept["Infrastructure"]],
      ["Hana Kimura", "hana@company.com", dept["Infrastructure"]],
    ];
    const userId: Record<string, number> = {};
    for (const [name, email, department_id] of deptMemberSeed) {
      const r = await client.query<{ id: number }>(
        `INSERT INTO users (name, email, password_hash, role, department_id)
         VALUES ($1, $2, $3, 'dept_member', $4) RETURNING id`,
        [name, email, defaultPasswordHash, department_id],
      );
      userId[email] = r.rows[0].id;
    }

    const endUserSeed: [string, string][] = [
      ["John Alvarez", "john@example.com"],
      ["Maria Santos", "maria@example.com"],
    ];
    for (const [name, email] of endUserSeed) {
      const r = await client.query<{ id: number }>(
        `INSERT INTO users (name, email, password_hash, role, department_id)
         VALUES ($1, $2, $3, 'end_user', $4) RETURNING id`,
        [name, email, defaultPasswordHash, dept["General Operations"]],
      );
      userId[email] = r.rows[0].id;
    }
    console.log("✓ Users seeded (password for all: password123).");

    // ---------- Tickets (20 total) ----------
    // Each entry: [typeId, title, description, creatorEmail, finalStepOrder, status, assigneeEmail | null]
    const helpDeskMembers = [
      "alice@company.com",
      "ben@company.com",
      "carla@company.com",
    ];
    const sweMembers = [
      "dave@company.com",
      "elena@company.com",
      "feye@company.com",
    ];
    const infraMembers = ["george@company.com", "hana@company.com"];
    const endUsers = ["john@example.com", "maria@example.com"];

    type TicketSeed = {
      typeId: number;
      title: string;
      description: string;
      creator: string;
      finalStep: number;
      status: string;
      assignee: string | null;
    };

    const ticketSeeds: TicketSeed[] = [
      {
        typeId: type.hardware_prob,
        title: "Laptop won't power on",
        description:
          "No response when pressing the power button, even when plugged in.",
        creator: endUsers[0],
        finalStep: 1,
        status: "Open",
        assignee: null,
      },
      {
        typeId: type.hardware_prob,
        title: "Monitor flickering intermittently",
        description:
          "External monitor flickers every few minutes, worse under load.",
        creator: endUsers[1],
        finalStep: 1,
        status: "In Progress",
        assignee: helpDeskMembers[0],
      },
      {
        typeId: type.hardware_prob,
        title: "Keyboard keys unresponsive",
        description:
          "Several keys on the right side of the keyboard stopped registering.",
        creator: endUsers[0],
        finalStep: 2,
        status: "Escalated",
        assignee: null,
      },
      {
        typeId: type.hardware_prob,
        title: "Docking station not detected",
        description: "USB-C dock is not recognized when laptop is connected.",
        creator: endUsers[1],
        finalStep: 2,
        status: "In Progress",
        assignee: infraMembers[0],
      },
      {
        typeId: type.hardware_prob,
        title: "Replacement charger needed",
        description:
          "Original charger frayed at the cable and stopped working.",
        creator: endUsers[0],
        finalStep: 2,
        status: "Resolved",
        assignee: infraMembers[1],
      },
      {
        typeId: type.hardware_prob,
        title: "Second monitor dead pixel cluster",
        description:
          "Noticed a cluster of dead pixels in the top-right corner.",
        creator: endUsers[1],
        finalStep: 2,
        status: "Closed",
        assignee: infraMembers[0],
      },
      {
        typeId: type.hardware_prob,
        title: "Laptop overheating under load",
        description:
          "Fans run constantly and the chassis gets very hot during video calls.",
        creator: endUsers[0],
        finalStep: 1,
        status: "Open",
        assignee: null,
      },

      {
        typeId: type.software_prob,
        title: "App crashes on login",
        description:
          "Internal portal throws an error immediately after entering credentials.",
        creator: endUsers[1],
        finalStep: 1,
        status: "Open",
        assignee: null,
      },
      {
        typeId: type.software_prob,
        title: "Cannot install approved software",
        description:
          "Installer is blocked by a permissions error despite IT approval.",
        creator: endUsers[0],
        finalStep: 1,
        status: "In Progress",
        assignee: helpDeskMembers[1],
      },
      {
        typeId: type.software_prob,
        title: "Report export produces blank PDF",
        description:
          "Exporting the monthly report generates a blank PDF instead of data.",
        creator: endUsers[1],
        finalStep: 2,
        status: "Escalated",
        assignee: null,
      },
      {
        typeId: type.software_prob,
        title: "License activation failing",
        description:
          "Design software reports an invalid license key on every launch.",
        creator: endUsers[0],
        finalStep: 2,
        status: "In Progress",
        assignee: sweMembers[0],
      },
      {
        typeId: type.software_prob,
        title: "Spreadsheet macro throwing errors",
        description:
          "A previously working macro now throws a runtime error on open.",
        creator: endUsers[1],
        finalStep: 2,
        status: "Resolved",
        assignee: sweMembers[1],
      },
      {
        typeId: type.software_prob,
        title: "Email client sync stopped",
        description:
          "New emails are not syncing across devices since this morning.",
        creator: endUsers[0],
        finalStep: 2,
        status: "Closed",
        assignee: sweMembers[2],
      },
      {
        typeId: type.software_prob,
        title: "Video conferencing app freezes",
        description: "App freezes shortly after screen sharing is started.",
        creator: endUsers[1],
        finalStep: 1,
        status: "Open",
        assignee: null,
      },

      {
        typeId: type.network_prob,
        title: "Office Wi-Fi dropping frequently",
        description:
          "Wireless connection drops every 10-15 minutes throughout the day.",
        creator: endUsers[0],
        finalStep: 1,
        status: "Open",
        assignee: null,
      },
      {
        typeId: type.network_prob,
        title: "VPN connection times out",
        description:
          "VPN client fails to establish a connection when working remotely.",
        creator: endUsers[1],
        finalStep: 1,
        status: "In Progress",
        assignee: helpDeskMembers[2],
      },
      {
        typeId: type.network_prob,
        title: "Slow file transfer speeds",
        description:
          "Transferring files to the shared drive is far slower than usual.",
        creator: endUsers[0],
        finalStep: 2,
        status: "Escalated",
        assignee: null,
      },
      {
        typeId: type.network_prob,
        title: "Printer unreachable over network",
        description:
          "Office printer no longer appears on the network device list.",
        creator: endUsers[1],
        finalStep: 2,
        status: "In Progress",
        assignee: sweMembers[0],
      },
      {
        typeId: type.network_prob,
        title: "Dashboard loads very slowly",
        description:
          "Internal analytics dashboard takes over 30 seconds to load.",
        creator: endUsers[0],
        finalStep: 3,
        status: "Escalated",
        assignee: null,
      },
      {
        typeId: type.network_prob,
        title: "Intermittent connectivity outages",
        description:
          "Entire floor loses network access for a few minutes at a time.",
        creator: endUsers[1],
        finalStep: 3,
        status: "Resolved",
        assignee: infraMembers[1],
      },
    ];

    console.log(`Seeding ${ticketSeeds.length} tickets...`);

    for (const seed of ticketSeeds) {
      const steps = Object.entries(pipelines).find(
        ([tid]) => Number(tid) === seed.typeId,
      )![1];
      const currentDeptId = steps[seed.finalStep - 1];
      const creatorId = userId[seed.creator];
      const assigneeId = seed.assignee ? userId[seed.assignee] : null;

      const ticketRes = await client.query<{ id: number; created_at: string }>(
        `INSERT INTO tickets (ticket_type_id, title, description, created_by, current_step_order, current_department_id, assigned_to, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, created_at`,
        [
          seed.typeId,
          seed.title,
          seed.description,
          creatorId,
          seed.finalStep,
          currentDeptId,
          assigneeId,
          seed.status,
        ],
      );
      const ticketId = ticketRes.rows[0].id;

      // Activity log: creation
      await client.query(
        `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, to_department_id, message)
         VALUES ($1, 'created', $2, $3, 'Ticket submitted.')`,
        [ticketId, creatorId, steps[0]],
      );

      // Activity log: one escalation entry per step beyond the first
      for (let step = 2; step <= seed.finalStep; step++) {
        await client.query(
          `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, from_department_id, to_department_id, message)
           VALUES ($1, 'escalated', $2, $3, $4, 'Escalated to next department in pipeline.')`,
          [ticketId, assigneeId || creatorId, steps[step - 2], steps[step - 1]],
        );
      }

      // Activity log: assignment
      if (assigneeId) {
        await client.query(
          `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, message)
           VALUES ($1, 'assigned', $2, $3)`,
          [ticketId, assigneeId, `Ticket assigned.`],
        );
      }

      // Activity log: status change, if resolved/closed
      if (seed.status === "Resolved" || seed.status === "Closed") {
        await client.query(
          `INSERT INTO ticket_activity_log (ticket_id, event_type, actor_id, old_status, new_status, message)
           VALUES ($1, 'status_changed', $2, 'In Progress', $3, 'Issue addressed.')`,
          [ticketId, assigneeId || creatorId, seed.status],
        );
      }
    }

    console.log("✓ Tickets and activity logs seeded.");

    await client.query("COMMIT");
    console.log("");
    console.log("========================================");
    console.log("DATABASE SEEDED SUCCESSFULLY");
    console.log(`Departments : 4`);
    console.log(`Ticket Types: 3`);
    console.log(`Users       : 10 (password: password123)`);
    console.log(`Tickets     : ${ticketSeeds.length}`);
    console.log("========================================");
    process.exit(0);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    client.release();
  }
}

seedDatabase();
