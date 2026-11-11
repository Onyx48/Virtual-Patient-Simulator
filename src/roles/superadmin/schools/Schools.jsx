import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useData, fetchCached } from "../../../lib/query";
import axios from "axios";
import { useAuth } from "../../../AuthContext";
import { useNavigate } from "../../../lib/router";
import { format } from "date-fns";
import { getAuthHeaders } from "../../../lib/utils.js";

import { Plus, Pencil, Trash2, Send, KeyRound, Loader2, UserPlus, Copy, ArrowUp, ArrowDown, CalendarPlus } from "lucide-react";
import { Button, ButtonGroup, RowActions } from "../../../components/vx/ui";
import { ListToolbar, Pagination } from "../../../components/vx/list";
import { CopyButton, Ago, Menu, copyText } from "../../../components/vx/bits";
import { RenewalChip } from "../Dashboard";
import { cn } from "../../../lib/utils";
import "../../../components/vx/vx.css";
import SchoolAdminModal from "../../../components/SchoolAdminModal.jsx";
import ConfirmationModal from "../../../components/ui/ConfirmationModal.jsx";
import { toast } from "react-hot-toast";
import { useServerPagination } from "../../../lib/hooks/useServerPagination";

const toSchoolRow = (school) => ({
  ...school,
  startDate: school.startDate ? new Date(school.startDate) : null,
  expireDate: school.expireDate ? new Date(school.expireDate) : null,
});

function SchoolsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [isSchoolAdminModalOpen, setIsSchoolAdminModalOpen] = useState(false);
  const [availableSchools, setAvailableSchools] = useState([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [onConfirmAction, setOnConfirmAction] = useState(() => {});
  const [isDeletingId, setIsDeletingId] = useState(null);
  const [isInvitingId, setIsInvitingId] = useState(null);

  const [sortConfig, setSortConfig] = useState(null);
  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" ? { key, direction: "desc" } : null;
      }
      return { key, direction: "asc" };
    });
  };

  const fetchAvailableSchools = useCallback(async () => {
    try {
      return (await fetchCached("/api/schools", { availableForSchoolAdmin: true })).map(toSchoolRow);
    } catch (err) {
      console.error("Error fetching available schools:", err);
      return [];
    }
  }, []);

  // Only the visible page is fetched; search and sort run server-side.
  const {
    paginatedData,
    isInitialLoading,
    refetch: fetchSchools,
    currentPage,
    totalItems,
    handlePageChange,
    pager,
  } = useServerPagination("/api/schools", {
    params: { searchTerm },
    pageSize: 10,
    sortConfig,
    mapItem: toSchoolRow,
  });

  const handleAddNewClick = () => {
    navigate("/schools/add");
  };

  const handleEditClick = (school) => {
    navigate(`/schools/edit/${school._id}`);
  };

  // Handle Delete
  const handleDeleteClick = (schoolId) => {
    setConfirmTitle("Delete School");
    setConfirmMessage(
      "Are you sure you want to delete this school? This action cannot be undone.",
    );
    setOnConfirmAction(() => async () => {
      setIsDeletingId(schoolId);
      try {
        await axios.delete(`/api/schools/${schoolId}`, getAuthHeaders());
        toast.success("School deleted successfully.");
        fetchSchools();
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || "Failed to delete school.");
      } finally {
        setIsDeletingId(null);
      }
    });
    setIsConfirmModalOpen(true);
  };

  // Sending credentials always issues a NEW password (the stored one is a hash
  // and cannot be re-read), so confirm before invalidating the existing one.
  const handleInviteClick = (school) => {
    const invited = school.inviteStatus === "invited";
    const target = school.assignedAdmin?.email || school.email;

    setConfirmTitle(invited ? "Send a new password" : "Send invite");
    setConfirmMessage(
      invited
        ? `Generate a new password for ${target} and email it? Their current password will stop working.`
        : school.assignedAdmin?.id
          ? `Email login credentials to ${target}?`
          : `${school.schoolName} has no admin yet. A school admin account will be created for ${target} and the credentials emailed to them.`,
    );
    setOnConfirmAction(() => async () => {
      setIsInvitingId(school._id);
      try {
        const { data } = await axios.post(
          `/api/schools/${school._id}/invite`,
          {},
          getAuthHeaders(),
        );
        toast.success(data.message || "Credentials sent.");
        fetchSchools();
      } catch (err) {
        console.error(err);
        toast.error(
          err.response?.data?.message || "Failed to send the credentials.",
        );
      } finally {
        setIsInvitingId(null);
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleCreateSchoolAdmin = async (data) => {
    try {
      await axios.post("/api/users", data, getAuthHeaders());
      toast.success("School Admin created successfully.");
      fetchSchools();
      setIsSchoolAdminModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create school admin.");
    }
  };

  const muted = "text-[rgb(var(--vx-muted))]";
  // Adoption per school from the platform overview, merged by id.
  // Shares the dashboard's cached overview (no second load when coming from the dashboard).
  const overview = useData("/api/dashboard/platform-overview", { fallback: { schools: [] } });
  const usage = useMemo(() => Object.fromEntries((overview?.schools || []).map((s) => [String(s._id), s])), [overview]);

  const Head = ({ k, children, right }) => (
    <th className={cn("whitespace-nowrap px-5 py-3 text-sm font-medium", muted, right ? "text-right" : "text-left")}>
      {k ? (
        <button type="button" onClick={() => handleSort(k)} className="inline-flex items-center gap-1 hover:text-[rgb(var(--vx-ink))]">
          {children}{sortConfig?.key === k && (sortConfig.direction === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
        </button>
      ) : children}
    </th>
  );

  const fmt = (d) => (d ? format(new Date(d), "d MMM yyyy") : "—");

  // Renewal in one step: the end date moves 12 months on from the later of today and the current end.
  const extendYear = (s) => {
    const base = s.expireDate && new Date(s.expireDate) > new Date() ? new Date(s.expireDate) : new Date();
    const next = new Date(base); next.setFullYear(next.getFullYear() + 1);
    setConfirmTitle(`Extend ${s.schoolName}?`);
    setConfirmMessage(`The subscription will end on ${format(next, "d MMM yyyy")} and the school stays Active.`);
    setOnConfirmAction(() => async () => {
      try {
        // PUT /api/schools/:id overwrites every field it is not sent, so send the whole record.
        await axios.put(`/api/schools/${s._id}`, {
          schoolName: s.schoolName, description: s.description || "", email: s.email, subscriptionType: s.subscriptionType,
          duration: s.duration || "1 Year", permissions: s.permissions || "Read Only", status: "Active",
          startDate: format(s.startDate ? new Date(s.startDate) : new Date(), "dd/MM/yyyy"), expireDate: format(next, "dd/MM/yyyy"),
        }, getAuthHeaders());
        toast.success(`Extended to ${format(next, "d MMM yyyy")}.`);
        fetchSchools();
      } catch (e) {
        toast.error(e.response?.data?.message || "Could not extend the subscription.");
      }
    });
    setIsConfirmModalOpen(true);
  };

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="flex items-baseline gap-3 text-3xl font-semibold tracking-tight">
            Schools {totalItems > 0 && <span className={cn("tabular-nums", muted)}>{totalItems}</span>}
          </h1>
          {user?.role === "superadmin" && (
            <Button variant="secondary" className="h-11" onClick={async () => { setAvailableSchools(await fetchAvailableSchools()); setIsSchoolAdminModalOpen(true); }}>
              <UserPlus /> New school admin
            </Button>
          )}
        </header>

        <ListToolbar
          search={{ value: searchTerm, onChange: setSearchTerm, placeholder: "Search schools" }}
          actions={user?.role === "superadmin" && <Button size="lg" className="h-11 rounded-[22px]" onClick={handleAddNewClick}><Plus /> New school</Button>}
        />

        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-cell)/0.5)]">
                <tr>
                  <Head k="schoolName">School</Head>
                  <Head>Admin</Head>
                  <Head right>Students</Head>
                  <Head right>Sessions (30 d)</Head>
                  <Head>Last session</Head>
                  <Head k="subscriptionType">Plan</Head>
                  <Head k="expireDate">Subscription</Head>
                  <Head><span className="sr-only">Actions</span></Head>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
                {isInitialLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={8} className="px-5 py-3"><div className="h-10 animate-pulse rounded-xl bg-[rgb(var(--vx-cell)/0.7)]" /></td></tr>)
                ) : paginatedData.length === 0 ? (
                  <tr><td colSpan={8} className={cn("px-5 py-16 text-center text-base", muted)}>{searchTerm ? "No schools match." : "No schools yet. Add the first one."}</td></tr>
                ) : paginatedData.map((s) => {
                  const u = usage[String(s._id)] || {};
                  const admin = s.assignedAdmin?.id ? s.assignedAdmin : null;
                  const invited = s.inviteStatus === "invited";
                  return (
                    <tr key={s._id} onClick={() => navigate(`/schools/${s._id}`)} className="group/row cursor-pointer transition-colors hover:bg-[rgb(var(--vx-accent)/0.05)]">
                      <td className="max-w-xs px-5 py-3">
                        <div className="truncate text-base font-semibold">{s.schoolName}</div>
                        <div className={cn("flex items-center gap-0.5 text-sm", muted)}>
                          <span className="truncate">{s.email || "—"}</span>
                          {s.email && <CopyButton value={s.email} label="Copy email" className="size-6 opacity-0 focus:opacity-100 group-hover/row:opacity-100" size={13} />}
                        </div>
                      </td>
                      <td className="max-w-[16rem] px-5 py-3">
                        {admin ? (
                          <>
                            <div className="truncate text-base">{admin.name || admin.email}</div>
                            <div className={cn("text-sm", muted)}>
                              {u.admin?.lastLoginAt ? <>signed in <Ago date={u.admin.lastLoginAt} /></> : invited ? "invited, not signed in yet" : "not invited yet"}
                            </div>
                          </>
                        ) : <span className="text-sm font-medium text-[rgb(var(--vx-warn))]">No admin yet</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-base tabular-nums">{u.students ?? "…"}<span className={cn("text-sm", muted)}>{u.educators != null ? ` · ${u.educators} ed.` : ""}</span></td>
                      <td className="px-5 py-3 text-right text-base font-semibold tabular-nums">{u.sessions30 ?? "…"}</td>
                      <td className={cn("whitespace-nowrap px-5 py-3 text-base", !u.lastSessionAt && muted)}><Ago date={u.lastSessionAt} fallback="None" /></td>
                      <td className="px-5 py-3 text-base">{s.subscriptionType || "—"}</td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <div className="flex flex-col items-start gap-0.5">
                          <RenewalChip daysLeft={u.daysLeft ?? (s.expireDate ? Math.ceil((new Date(s.expireDate) - Date.now()) / 86400000) : null)} status={s.status} />
                          <span className={cn("text-sm", muted)}>{fmt(s.startDate)} – {fmt(s.expireDate)}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {user?.role === "superadmin" && (
                          <RowActions items={[
                            { icon: invited ? KeyRound : Send, label: invited ? "New password" : "Send invite", busy: isInvitingId === s._id, onClick: () => handleInviteClick(s) },
                            { icon: Pencil, label: "Edit", onClick: () => handleEditClick(s) },
                            { icon: CalendarPlus, label: "Extend a year", onClick: () => extendYear(s) },
                            { icon: Copy, label: "Copy email", hidden: !s.email, onClick: () => copyText(s.email, "Email copied") },
                            { icon: Trash2, label: "Delete", danger: true, busy: isDeletingId === s._id, onClick: () => handleDeleteClick(s._id) },
                          ]} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5">
            <Pagination {...pager} />
          </div>
        </div>
      </div>

      {isSchoolAdminModalOpen && (
        <SchoolAdminModal schools={availableSchools} onSave={handleCreateSchoolAdmin} onClose={() => setIsSchoolAdminModalOpen(false)} />
      )}

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={() => { onConfirmAction(); setIsConfirmModalOpen(false); }}
        title={confirmTitle}
        message={confirmMessage}
      />
    </div>
  );
}

export default SchoolsPage;
