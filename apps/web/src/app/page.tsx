"use client";
import { useEffect, useState } from "react";

type Ticket = {
  id: number;
  title: string;
  description: string;
  status: string;
  created_at: string;
  current_step_order: number;
  ticket_type_id: number;
  ticket_type: string;
  department_id: number;
  department_name: string;
  creator_id: number;
  creator_name: string;
  assignee_id: number | null;
  assignee_name: string | null;
};

type Department = { id: number; name: string };
type User = { id: number; name: string; role: string; department_id: number };
type TicketType = { id: number; key: string; label: string };

export default function Home() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ticketTypeId, setTicketTypeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // "Acting as" hat switcher
  const [actingAsId, setActingAsId] = useState<number | null>(null);
  const actingAsUser = users.find((u) => u.id === actingAsId) || null;

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [ticketsRes, deptsRes, usersRes, typesRes] = await Promise.all([
        fetch("http://localhost:4000/api/dev/tickets"),
        fetch("http://localhost:4000/api/dev/departments"),
        fetch("http://localhost:4000/api/dev/users"),
        fetch("http://localhost:4000/api/dev/ticket-types"),
      ]);
      const [ticketsData, deptsData, usersData, typesData] = await Promise.all([
        ticketsRes.json(),
        deptsRes.json(),
        usersRes.json(),
        typesRes.json(),
      ]);
      setTickets(Array.isArray(ticketsData) ? ticketsData : []);
      setDepartments(Array.isArray(deptsData) ? deptsData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setTicketTypes(Array.isArray(typesData) ? typesData : []);
      if (
        Array.isArray(typesData) &&
        typesData.length > 0 &&
        ticketTypeId === null
      ) {
        setTicketTypeId(typesData[0].id);
      }
      if (
        Array.isArray(usersData) &&
        usersData.length > 0 &&
        actingAsId === null
      ) {
        const firstDeptMember = usersData.find(
          (u: User) => u.role === "dept_member",
        );
        if (firstDeptMember) setActingAsId(firstDeptMember.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:4000/api/dev/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          ticket_type_id: ticketTypeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error);
      setTitle("");
      setDescription("");
      fetchAll();
    } catch (err) {
      console.error(err);
      alert("Failed to create ticket.");
    }
  };

  const updateStatus = async (ticketId: number, status: string) => {
    const res = await fetch(
      `http://localhost:4000/api/dev/tickets/${ticketId}/status`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, actor_id: actingAsId }),
      },
    );
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    fetchAll();
  };

  const assignTicket = async (ticketId: number, assigneeId: number) => {
    const res = await fetch(
      `http://localhost:4000/api/dev/tickets/${ticketId}/assign`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee_id: assigneeId, actor_id: actingAsId }),
      },
    );
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    fetchAll();
  };

  const escalateTicket = async (ticketId: number) => {
    const res = await fetch(
      `http://localhost:4000/api/dev/tickets/${ticketId}/escalate`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Escalated by ${actingAsUser?.name || "unknown"}`,
          actor_id: actingAsId,
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    fetchAll();
  };

  const membersOf = (departmentId: number) =>
    users.filter(
      (u) => u.department_id === departmentId && u.role === "dept_member",
    );

  return (
    <main
      style={{
        maxWidth: 1400,
        margin: "40px auto",
        fontFamily: "Arial, sans-serif",
        padding: 20,
      }}
    >
      <h1>IT Ticketing System</h1>
      <p>Development Sandbox — Multi-Department View</p>

      {/* HAT SWITCHER */}
      <section
        style={{
          background: "#f5f5f5",
          padding: 15,
          borderRadius: 8,
          marginBottom: 20,
          display: "flex",
          gap: 15,
          alignItems: "center",
        }}
      >
        <strong>Acting as:</strong>
        <select
          value={actingAsId ?? ""}
          onChange={(e) => setActingAsId(Number(e.target.value))}
          style={{ padding: 6 }}
        >
          {departments.map((dept) => (
            <optgroup key={dept.id} label={dept.name}>
              {membersOf(dept.id).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {actingAsUser && (
          <span style={{ color: "#555" }}>
            {actingAsUser.name} —{" "}
            {departments.find((d) => d.id === actingAsUser.department_id)?.name}
          </span>
        )}
      </section>

      {/* CREATE TICKET */}
      <section
        style={{
          border: "1px solid #ddd",
          padding: 20,
          borderRadius: 8,
          marginBottom: 30,
        }}
      >
        <h2>Create Ticket</h2>
        <form
          onSubmit={createTicket}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ticket title"
            required
            style={{ padding: 8 }}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue..."
            rows={3}
            style={{ padding: 8 }}
          />
          <select
            value={ticketTypeId ?? ""}
            onChange={(e) => setTicketTypeId(Number(e.target.value))}
            style={{ padding: 8 }}
          >
            {ticketTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <button type="submit" style={{ width: 200, padding: 10 }}>
            Submit Ticket
          </button>
        </form>
      </section>

      {/* DEPARTMENT QUEUES */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        departments.map((dept) => {
          const deptTickets = tickets.filter(
            (t) => t.department_id === dept.id,
          );
          const unassigned = deptTickets.filter((t) => t.assignee_id === null);
          const assigned = deptTickets.filter((t) => t.assignee_id !== null);
          const members = membersOf(dept.id);

          return (
            <section key={dept.id} style={{ marginBottom: 40 }}>
              <h2>{dept.name}</h2>

              <h3 style={{ color: "#555" }}>
                Unassigned ({unassigned.length})
              </h3>
              <TicketTable
                tickets={unassigned}
                members={members}
                onAssign={assignTicket}
                onEscalate={escalateTicket}
                onStatusChange={updateStatus}
              />

              <h3 style={{ color: "#555", marginTop: 20 }}>
                Assigned ({assigned.length})
              </h3>
              <TicketTable
                tickets={assigned}
                members={members}
                onAssign={assignTicket}
                onEscalate={escalateTicket}
                onStatusChange={updateStatus}
              />
            </section>
          );
        })
      )}
    </main>
  );
}

function TicketTable({
  tickets,
  members,
  onAssign,
  onEscalate,
  onStatusChange,
}: {
  tickets: Ticket[];
  members: User[];
  onAssign: (ticketId: number, assigneeId: number) => void;
  onEscalate: (ticketId: number) => void;
  onStatusChange: (ticketId: number, status: string) => void;
}) {
  if (tickets.length === 0) return <p style={{ color: "#999" }}>None</p>;

  return (
    <table
      style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}
    >
      <thead>
        <tr style={{ borderBottom: "2px solid black" }}>
          <th>ID</th>
          <th>Title</th>
          <th>Type</th>
          <th>Creator</th>
          <th>Assignee</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {tickets.map((ticket) => (
          <tr key={ticket.id} style={{ borderBottom: "1px solid #eee" }}>
            <td>#{ticket.id}</td>
            <td>{ticket.title}</td>
            <td>{ticket.ticket_type}</td>
            <td>{ticket.creator_name}</td>
            <td>
              {ticket.assignee_name ?? (
                <span style={{ color: "gray" }}>Unassigned</span>
              )}
            </td>
            <td>
              <select
                value={ticket.status}
                onChange={(e) => onStatusChange(ticket.id, e.target.value)}
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Escalated">Escalated</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </td>
            <td style={{ display: "flex", gap: 6 }}>
              <select
                onChange={(e) =>
                  e.target.value && onAssign(ticket.id, Number(e.target.value))
                }
                defaultValue=""
              >
                <option value="" disabled>
                  Assign to...
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button onClick={() => onEscalate(ticket.id)}>Escalate</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
