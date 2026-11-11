import { getAccessToken } from "../../lib/authToken.js";
import { useCached, fetchCached } from "../../lib/query";
import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "../../lib/router";
import axios from "axios";
import * as XLSX from "xlsx";
import { Plus, Pencil, Trash2, Upload, Download, ClipboardList, FileText, Loader2, ArrowUp, ArrowDown, Bell, KeyRound, Mail, Copy, X, FileSpreadsheet } from "lucide-react";
import { CopyButton, Ago, copyText, downloadCsv, mailto, Tick, Menu, Select, MiniRing, Intro, ActivityDot } from "../vx/bits";
import { Dialog } from "../vx/ui";
import StudentDrawer from "./StudentDrawer";
import ComposeEmail from "./ComposeEmail";
import GroupsPanel from "./GroupsPanel";
import { Layers, PenLine } from "lucide-react";
import { Users as UsersIcon, ChevronDown } from "lucide-react";
import { Button, ButtonGroup, RowActions } from "../vx/ui";
import { ListToolbar, ToolbarToggle, Pagination } from "../vx/list";
import { cn } from "../../lib/utils";

import {
  ACCEPTED_EXTENSIONS,
  buildTemplateWorkbook,
  buildUserPayload,
  readRows,
  templateFilename,
} from "../../lib/bulkUsers";

import StudentModal from "../StudentModal";
import AssignScenariosModal from "./AssignScenariosModal";
import TranscriptViewerModal from "../ui/TranscriptViewerModal";
import ConfirmationModal from "../ui/ConfirmationModal";
import { toast } from "react-hot-toast";
import { useAuth } from "../../AuthContext";
import { useServerPagination } from "../../lib/hooks/useServerPagination";
import { snapSize } from "../../lib/hooks/usePagedRows";

const getAuthHeaders = () => {
  const token = getAccessToken();
  return { headers: { Authorization: `Bearer ${token}` } };
};

/*
 * Mirrors backend/utils/inviteStatus.js. `pending` is styled as a warning
 * rather than a neutral state on purpose — it means this person was never sent
 * a way to log in, which is a problem to fix, not a stage to wait out.
 */
const INVITE_BADGES = {
  active: { label: "Active", className: "bg-[rgb(var(--vx-ok)/0.12)] text-[rgb(var(--vx-ok))]" },
  invited: { label: "Invited", className: "bg-[rgb(var(--vx-cell))] text-[rgb(var(--vx-ink))]" },
  pending: { label: "Pending", className: "bg-[rgb(var(--vx-warn)/0.14)] text-[rgb(var(--vx-warn))]" },
};

function InviteStatusCell({ student, canResend, isBusy, onResend }) {
  const badge = INVITE_BADGES[student.inviteStatus] || INVITE_BADGES.pending;
  const sentAt = student.credentialsSentAt
    ? new Date(student.credentialsSentAt).toLocaleDateString()
    : null;

  const title =
    student.inviteStatus === "active"
      ? "This student has logged in successfully."
      : sentAt
        ? `Login details were emailed on ${sentAt}, but the account has not been used yet.`
        : "No login details have ever reached this student. Click to send them.";

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        title={title}
        className={`inline-flex items-center rounded-full px-3 py-0.5 text-sm font-medium ${badge.className}`}
      >
        {badge.label}
      </span>
      {canResend && (
        <button
          onClick={(e) => { e.stopPropagation(); onResend(); }}
          title={student.inviteStatus === "pending" ? "Email their login details" : "Email a new password. Their current password stops working."}
          disabled={isBusy}
          className="text-sm font-medium text-[rgb(var(--vx-accent-text))] hover:underline underline-offset-2 disabled:opacity-50 disabled:no-underline"
        >
          {isBusy ? "Sending…" : student.inviteStatus === "pending" ? "Send login" : (
            <span className="inline-flex items-center gap-1"><KeyRound size={13} /> New password</span>
          )}
        </button>
      )}
    </div>
  );
}

function StudentPage({ role }) {
  const { user } = useAuth();

  // A school_admin does not assign scenarios (that stays with educators), so
  // neither the Scenarios column nor its filter is shown to them.
  // Groups are per-school, and GET /api/groups already scopes a school_admin to
  // their own school, so they get the same grouping tools an educator has.
  const showGroupColumn = role === "educator" || role === "school_admin";
  const showScenariosColumn = role !== "school_admin";
  const canManageStudents = role !== "school_admin";



  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);


  // The dashboard links here with ?progress=notstarted or ?assign=1.
  const [params, setParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => params.get("q") || "");
  // Header search links here with ?q=; follow it when it changes while already on this page.
  useEffect(() => { const q = params.get("q"); if (q !== null) setSearchTerm(q); }, [params]);
  const [filterAssigned, setFilterAssigned] = useState("");
  const [filterGroup, setFilterGroup] = useState(() => params.get("group") || "");
  const [drawer, setDrawer] = useState(null);
  const [assignFor, setAssignFor] = useState("");
  const [bulkDelete, setBulkDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [compose, setCompose] = useState(null); // { students } or { group }
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [filterProgress, setFilterProgress] = useState(() => params.get("progress") || "");

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(() => params.get("assign") === "1" && role !== "school_admin");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);

  // Which row's resend is in flight, so only that badge shows a spinner and a
  // double click cannot mail two different passwords in a row (the second would
  // win and the first email would be dead on arrival).
  const [resendingId, setResendingId] = useState(null);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [onConfirmAction, setOnConfirmAction] = useState(() => {});

  /*
   * Rows as the table renders them, applied to each page as it arrives from
   * the server — see useServerPagination below.
   */
  const toRow = (student) => ({
    id: student._id,
    visualId: `VS${student._id.slice(-6).toUpperCase()}`,
    user_id: student._id,
    name: student.name || "Unknown",
    email: student.email || "No Email",
    schoolName: student.schoolId?.schoolName || "Unassigned",
    groupName: student.groupId?.name || null,
    groupId: student.groupId || null,
    progress: student.avgScore != null
      ? `${Math.round(student.avgScore * 100)}%`
      : "N/A",
    assignedScenariosCount: student.assignedScenariosCount || 0,
    isAssigned: (student.assignedScenariosCount || 0) > 0,
    bestScore: student.bestScore != null
      ? `${Math.round(student.bestScore * 100)}%`
      : null,
    totalSessions: student.totalSessions || 0,
    inviteStatus: student.inviteStatus || "pending",
    credentialsSentAt: student.credentialsSentAt || null,
    lastSessionAt: student.lastSessionAt || null,
    lastLoginAt: student.lastLoginAt || null,
    originalData: student,
  });

  // Groups are optional; a failed read leaves the list empty.
  const [cachedGroups, setGroups, fetchGroups] = useCached("/api/groups", { enabled: !!showGroupColumn, fallback: [] });
  const groups = cachedGroups || [];

  useEffect(() => {
    const handleScenarioAssignmentsChanged = () => {
      fetchStudents();
    };
    window.addEventListener(
      "scenarioAssignmentsChanged",
      handleScenarioAssignmentsChanged,
    );
    return () => {
      window.removeEventListener(
        "scenarioAssignmentsChanged",
        handleScenarioAssignmentsChanged,
      );
    };
  }, []);

  const handleAddNew = () => {
    setEditingStudent(null);
    setIsStudentModalOpen(true);
  };

  const handleBulkUploadClick = () => {
    fileInputRef.current.click();
  };

  /*
   * Hands the user the exact file the importer wants, rather than describing it
   * and hoping. Written with XLSX so the download is a real workbook that opens
   * in Excel — a .csv named .xlsx makes Excel complain about the format.
   */
  const handleDownloadTemplate = () => {
    XLSX.writeFile(buildTemplateWorkbook("student"), templateFilename("student"));
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const clearInput = () => {
      // Reset so picking the same file again re-fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    setIsUploading(true);
    const uploadToast = toast.loading(`Reading ${file.name}...`);

    let parsed;
    try {
      parsed = buildUserPayload(await readRows(file), "student");
    } catch (error) {
      toast.error(error.message, { id: uploadToast, duration: 6000 });
      setIsUploading(false);
      clearInput();
      return;
    }

    const { users, errors, missing } = parsed;

    if (missing.length > 0) {
      toast.error(
        `That file is missing the ${missing.join(" and ")} column. Download the template to see the expected layout.`,
        { id: uploadToast, duration: 8000 },
      );
      setIsUploading(false);
      clearInput();
      return;
    }

    /*
     * Bad rows are shown to the user, not just logged. The old version put them
     * in the console and told the user to "check console", which nobody outside
     * this team is going to do — so a failed import looked like a partial
     * success with no explanation.
     */
    const describe = (list) =>
      list
        .slice(0, 5)
        .map((e) => `Row ${e.row}: ${e.reason}`)
        .join("\n") + (list.length > 5 ? `\n...and ${list.length - 5} more.` : "");

    if (users.length === 0) {
      toast.error(
        errors.length > 0
          ? `Nothing could be imported.\n${describe(errors)}`
          : "That file has the right columns but no student rows.",
        { id: uploadToast, duration: 10000, style: { whiteSpace: "pre-line" } },
      );
      setIsUploading(false);
      clearInput();
      return;
    }

    toast.loading(`Uploading ${users.length} students...`, { id: uploadToast });
    try {
      const response = await axios.post(
        "/api/users/bulk",
        { users, role: "student" },
        getAuthHeaders(),
      );
      toast.success(`Upload complete! ${response.data.successCount} created.`, {
        id: uploadToast,
        duration: 5000,
      });

      // Rows the server rejected — an address already in use, most often — are
      // reported the same way as the ones this file failed on.
      const serverErrors = (response.data.errors || []).map((e) => ({
        row: "—",
        reason: `${e.email}: ${e.reason}`,
      }));
      const allErrors = [...errors, ...serverErrors];
      if (allErrors.length > 0) {
        console.error("Bulk upload failures:", allErrors);
        toast.error(`${allErrors.length} row(s) were skipped.\n${describe(allErrors)}`, {
          duration: 10000,
          style: { whiteSpace: "pre-line" },
        });
      }
      await fetchStudents();
    } catch (error) {
      toast.error(
        "Bulk upload failed: " + (error.response?.data?.message || "Server error"),
        { id: uploadToast },
      );
    } finally {
      setIsUploading(false);
      clearInput();
    }
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setIsStudentModalOpen(true);
  };

  const handleDelete = (id) => {
    setConfirmTitle("Delete Student");
    setConfirmMessage("Are you sure you want to delete this student?");
    setOnConfirmAction(() => async () => {
      try {
        await axios.delete(`/api/users/${id}`, getAuthHeaders());
        fetchStudents();
        toast.success("Student deleted successfully");
      } catch (error) {
        toast.error(
          "Failed to delete student: " +
            (error.response?.data?.message || error.message),
        );
      }
    });
    setIsConfirmModalOpen(true);
  };

  /*
   * Confirmed rather than fired on the first click, because it is destructive in
   * a way the label does not suggest: the stored password is only a bcrypt hash,
   * so it cannot be read back and re-sent. A resend issues a *new* password and
   * the old one stops working — which locks the student out if they had already
   * received and were using the first one.
   */
  const requestResend = (student) => {
    setConfirmTitle("Send new login details");
    setConfirmMessage(
      `Email a newly generated password to ${student.email}. ` +
        "Their current password will stop working immediately — the existing one " +
        "cannot be re-sent because it is only stored encrypted.",
    );
    setOnConfirmAction(() => async () => {
      setResendingId(student.id);
      try {
        const { data } = await axios.post(
          `/api/users/${student.id}/resend-invite`,
          {},
          getAuthHeaders(),
        );
        // Reflect the new status without a refetch, which would otherwise be
        // served the stale cached roster.
        setStudents((prev) =>
          prev.map((s) =>
            s.id === student.id
              ? {
                  ...s,
                  inviteStatus: s.inviteStatus === "active" ? "active" : "invited",
                  credentialsSentAt: data.credentialsSentAt || new Date().toISOString(),
                }
              : s,
          ),
        );
        toast.success(data.message || "Login details sent.");
      } catch (error) {
        toast.error(
          error.response?.data?.message ||
            "Could not send the login details. Nothing was changed.",
        );
      } finally {
        setResendingId(null);
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleSaveStudent = async (formData) => {
    try {
      if (formData.id) {
        await axios.put(
          `/api/users/${formData.user_id}`,
          {
            name: formData.name,
            email: formData.email,
            // Pass null through, so clearing the group is not mistaken for
            // "field not supplied".
            ...(formData.groupId !== undefined && {
              groupId: formData.groupId,
            }),
          },
          getAuthHeaders(),
        );
        toast.success("Student updated successfully.");
      } else {
        const { data } = await axios.post(
          "/api/users",
          {
            name: formData.name,
            email: formData.email,
            role: "student",
            ...(formData.groupId && { groupId: formData.groupId }),
            ...(formData.newGroupName && { newGroupName: formData.newGroupName }),
          },
          getAuthHeaders(),
        );
        /*
         * The account is created either way, so this is not an error — but it is
         * not a plain success either. Reporting only "created" is what let
         * students be added with no idea their credentials never went out.
         */
        if (data?.emailSent === false) {
          toast.error(
            `Student created, but the login email was not sent. ${data.emailError || ""} ` +
              "Use Resend in the Login column once email is working.",
            { duration: 9000 },
          );
        } else {
          toast.success("Student created and login details emailed.");
        }
      }
      await Promise.all([fetchStudents(), showGroupColumn ? fetchGroups() : Promise.resolve()]);
      setIsStudentModalOpen(false);
    } catch (error) {
      toast.error(
        "Error saving student: " +
          (error.response?.data?.message || error.message),
      );
    }
  };

  const [sortConfig, setSortConfig] = useState(null);
  const [pageSize, setPageSize] = useState(() => { try { return snapSize(Number(localStorage.getItem("vps.pageSize")) || 10); } catch { return 10; } });
  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" ? { key, direction: "desc" } : null;
      }
      return { key, direction: "asc" };
    });
  };



  // Only the visible page is fetched; search, filters and sort run server-side.
  const {
    paginatedData,
    setPaginatedData: setStudents,
    isLoading,
    refetch: fetchStudents,
    currentPage,
    totalItems,
    handlePageChange,
  } = useServerPagination("/api/students", {
    params: { searchTerm, assigned: filterAssigned, progress: filterProgress, groupId: filterGroup },
    pageSize,
    sortConfig,
    mapItem: toRow,
  });

  const muted = "text-[rgb(var(--vx-muted))]";
  const filtersOn = !!(filterAssigned || filterProgress || filterGroup);
  // Filters live in the URL, so Back and a shared link return to the same list.
  useEffect(() => {
    const next = new URLSearchParams();
    if (searchTerm) next.set("q", searchTerm);
    if (filterProgress) next.set("progress", filterProgress);
    if (filterGroup) next.set("group", filterGroup);
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [searchTerm, filterProgress, filterGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  // Move one or many students to a group (null = no group). Uses the same endpoint as the edit form.
  const moveToGroup = async (rows, groupId) => {
    setBulkBusy(true);
    const results = await Promise.allSettled(rows.map((r) => axios.put(`/api/users/${r.user_id}`, { groupId }, getAuthHeaders())));
    const failed = results.filter((x) => x.status === "rejected").length;
    const g = groups.find((x) => x._id === groupId);
    if (failed) toast.error(`${failed} of ${rows.length} could not be moved.`);
    else toast.success(`${rows.length === 1 ? rows[0].name : `${rows.length} students`} moved to ${g ? g.name : "no group"}.`);
    setBulkBusy(false);
    setPicked({});
    fetchStudents();
  };
  const groupItems = (rows) => [
    ...groups.map((g) => ({ label: g.name, icon: UsersIcon, onClick: () => moveToGroup(rows, g._id) })),
    "sep",
    { label: "No group", onClick: () => moveToGroup(rows, null) },
  ];
  const deleteMany = async () => {
    setBulkBusy(true);
    const rows = pickedList;
    const results = await Promise.allSettled(rows.map((r) => axios.delete(`/api/users/${r.id}`, getAuthHeaders())));
    const failed = results.filter((x) => x.status === "rejected").length;
    if (failed) toast.error(`${failed} of ${rows.length} could not be deleted.`);
    else toast.success(`Deleted ${rows.length} student${rows.length === 1 ? "" : "s"}.`);
    setBulkBusy(false);
    setBulkDelete(false);
    setConfirmText("");
    setPicked({});
    fetchStudents();
  };

  // Selection survives paging (keyed by id, value is the row) so a cohort can be picked across pages.
  const [picked, setPicked] = useState({});
  const lastClicked = useRef(null);
  const pickedList = Object.values(picked);
  const pageIds = paginatedData.map((r) => r.id);
  const pagePicked = pageIds.filter((id) => picked[id]).length;
  const togglePick = (row, e) => {
    setPicked((prev) => {
      const next = { ...prev };
      // Shift-click picks the range from the last clicked row on this page.
      if (e?.shiftKey && lastClicked.current != null) {
        const a = pageIds.indexOf(lastClicked.current), b = pageIds.indexOf(row.id);
        if (a > -1 && b > -1) {
          const on = !prev[row.id];
          paginatedData.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((r) => { if (on) next[r.id] = r; else delete next[r.id]; });
          return next;
        }
      }
      if (next[row.id]) delete next[row.id]; else next[row.id] = row;
      return next;
    });
    lastClicked.current = row.id;
  };
  const togglePage = () => setPicked((prev) => {
    const next = { ...prev };
    if (pagePicked === pageIds.length) pageIds.forEach((id) => delete next[id]);
    else paginatedData.forEach((r) => { next[r.id] = r; });
    return next;
  });

  const first = (name) => String(name || "").split(" ")[0];
  const reminder = (rows) => mailto({
    to: rows.length === 1 ? [rows[0].email] : [],
    bcc: rows.length > 1 ? rows.map((r) => r.email) : [],
    subject: "Reminder: practise your virtual patient scenarios",
    body: `Hi ${rows.length === 1 ? first(rows[0].name) : "everyone"},\n\n` +
      "A reminder to practise the scenarios assigned to you on the Virtual Patient Simulator. " +
      "Each session takes about 15 minutes and you can repeat it as often as you like.\n\n" +
      `Sign in here: ${window.location.origin}/login\n\nThanks,\n${user?.name || ""}`,
  });

  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try {
      // Same filters as the table, fetched 100 at a time.
      const all = [];
      for (let page = 1; ; page++) {
        const data = await fetchCached("/api/students", {
          searchTerm, assigned: filterAssigned, progress: filterProgress, groupId: filterGroup, page, limit: 100,
          ...(sortConfig && { sortBy: sortConfig.key, sortDir: sortConfig.direction }),
        });
        all.push(...data.items.map(toRow));
        if (page >= data.totalPages) break;
      }
      const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
      downloadCsv(`students-${new Date().toISOString().slice(0, 10)}.csv`, [
        { label: "Name", value: (r) => r.name },
        { label: "Email", value: (r) => r.email },
        { label: "Group", value: (r) => r.groupName || "" },
        { label: "Sessions", value: (r) => r.totalSessions },
        { label: "Average", value: (r) => (r.progress === "N/A" ? "" : r.progress) },
        { label: "Best", value: (r) => r.bestScore || "" },
        { label: "Scenarios assigned", value: (r) => r.assignedScenariosCount },
        { label: "Last session", value: (r) => iso(r.lastSessionAt) },
        { label: "Login", value: (r) => r.inviteStatus },
        { label: "ID", value: (r) => r.visualId },
      ], all);
      toast.success(`Exported ${all.length} student${all.length === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not export the list.");
    } finally {
      setExporting(false);
    }
  };
  const Head = ({ k, children, className }) => {
    const on = sortConfig?.key === k;
    return (
      <th className={cn("whitespace-nowrap px-5 py-3 text-left text-sm font-medium", muted, className)}>
        {k ? (
          <button type="button" onClick={() => handleSort(k)} className="inline-flex items-center gap-1 hover:text-[rgb(var(--vx-ink))]">
            {children}
            {on && (sortConfig.direction === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
          </button>
        ) : children}
      </th>
    );
  };
  const showSchoolColumn = role === "superadmin";
  const cols = 8 + (showSchoolColumn ? 1 : 0) + (showGroupColumn ? 1 : 0) + (showScenariosColumn ? 1 : 0);

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="flex items-baseline gap-3 text-3xl font-semibold tracking-tight">
            Students {totalItems > 0 && <span className={cn("tabular-nums", muted)}>{totalItems}</span>}
          </h1>
          {canManageStudents && (
            <ButtonGroup>
              {showGroupColumn && (
                <Button variant="secondary" className="h-11" onClick={() => setGroupsOpen(true)}><Layers /> Groups</Button>
              )}
              {showScenariosColumn && (
                <Button variant="secondary" className="h-11" onClick={() => setIsAssignModalOpen(true)}>
                  <ClipboardList /> Assign scenarios
                </Button>
              )}
              <Button variant="secondary" className="h-11" onClick={handleDownloadTemplate} title="Download the .xlsx template for bulk upload">
                <Download /> Template
              </Button>
              <Button variant="secondary" className="h-11" onClick={handleBulkUploadClick} disabled={isUploading}>
                {isUploading ? <Loader2 className="animate-spin" /> : <Upload />} {isUploading ? "Uploading" : "Upload students"}
              </Button>
              <Button variant="secondary" className="h-11" onClick={exportCsv} disabled={exporting || totalItems === 0} title="Download this list as a spreadsheet (CSV)">
                {exporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Export
              </Button>
            </ButtonGroup>
          )}
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept={ACCEPTED_EXTENSIONS.join(",")} className="hidden" disabled={isUploading} />
        </header>

        <Intro id="students" steps={[
          { title: "Click a row to open a student", body: "Their scores over time, each scenario's best, reflections and your private note." },
          { title: "Select several to act at once", body: "Shift-click selects a range. Then remind, write an email, move to a group or delete." },
          { title: "Groups are classes", body: "Groups → Open class shows a join code students type to join, and how the class is doing." },
        ]} />
        <ListToolbar
          search={{ value: searchTerm, onChange: setSearchTerm, placeholder: "Search name or email" }}
          filters={
            <>
              {showScenariosColumn && (
                <ToolbarToggle label="Scenarios" value={filterAssigned} onChange={setFilterAssigned}
                  options={[{ value: "", label: "All" }, { value: "assigned", label: "Assigned" }, { value: "unassigned", label: "Not assigned" }]} />
              )}
              {showGroupColumn && groups.length > 0 && (
                <div className="px-1">
                  <Select variant="ghost" label="Group" value={filterGroup} onChange={setFilterGroup}
                    options={[{ value: "", label: "All groups" }, ...groups.map((g) => ({ value: g._id, label: g.name, hint: g.studentCount })), { value: "none", label: "No group" }]} />
                </div>
              )}
              <ToolbarToggle label="Progress" value={filterProgress} onChange={setFilterProgress}
                options={[{ value: "", label: "Any progress" }, ...(showScenariosColumn ? [{ value: "notstarted", label: "Not started" }] : []), { value: "active", label: "Has sessions" }, { value: "inactive", label: "No sessions" }]} />
            </>
          }
          actions={canManageStudents && (
            <Button size="lg" className="h-11 rounded-[22px]" onClick={handleAddNew}><Plus /> New student</Button>
          )}
        />

        {pickedList.length > 0 && (
          <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-[rgb(var(--vx-accent)/0.5)] bg-[rgb(var(--vx-card))] px-4 py-2 shadow-lg">
            <span className="text-base font-semibold tabular-nums">{pickedList.length} selected</span>
            <ButtonGroup>
              <Button variant="secondary" size="sm" onClick={() => copyText(pickedList.map((r) => r.email).join(", "), `${pickedList.length} emails copied`)}><Copy /> Copy emails</Button>
              <Button variant="secondary" size="sm" onClick={() => { window.location.href = reminder(pickedList); }}><Bell /> Remind</Button>
              {canManageStudents && <Button variant="secondary" size="sm" onClick={() => setCompose({ students: pickedList })}><PenLine /> Write email</Button>}
              <Button variant="secondary" size="sm" title="Open in your own mail app" onClick={() => { window.location.href = mailto({ bcc: pickedList.map((r) => r.email) }); }}><Mail /> Mail app</Button>
            </ButtonGroup>
            {canManageStudents && showGroupColumn && groups.length > 0 && (
              <span className="flex items-center gap-1 text-sm font-medium">
                Move to group <Menu label="Move to group" align="left" items={groupItems(pickedList)} />
              </span>
            )}
            {canManageStudents && (
              <Button variant="destructive" size="sm" disabled={bulkBusy} onClick={() => setBulkDelete(true)}><Trash2 /> Delete</Button>
            )}
            {bulkBusy && <Loader2 size={18} className={cn("animate-spin", muted)} />}
            <button type="button" onClick={() => setPicked({})} className={cn("ml-auto inline-flex items-center gap-1 text-sm font-medium hover:text-[rgb(var(--vx-ink))]", muted)}>
              <X size={16} /> Clear
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-cell)/0.5)]">
                <tr>
                  <th className="w-0 py-3 pl-5 pr-0">
                    <Tick label="Select this page" checked={pageIds.length > 0 && pagePicked === pageIds.length}
                      indeterminate={pagePicked > 0 && pagePicked < pageIds.length} onChange={togglePage} />
                  </th>
                  <Head k="name">Student</Head>
                  {showSchoolColumn && <Head k="schoolName">School</Head>}
                  {showGroupColumn && <Head k="groupName">Group</Head>}
                  <Head k="totalSessions">Progress</Head>
                  {showScenariosColumn && <Head k="assignedScenariosCount">Scenarios</Head>}
                  <Head k="lastSessionAt">Last session</Head>
                  <Head k="inviteStatus">Login</Head>
                  <Head>Transcript</Head>
                  <Head k="visualId">ID</Head>
                  <Head className="w-0"><span className="sr-only">Actions</span></Head>
                </tr>
              </thead>
              <tbody className={cn("divide-y divide-[rgb(var(--vx-line)/0.7)] transition-opacity", isLoading && paginatedData.length > 0 && "opacity-60")}>
                {isLoading && paginatedData.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}><td colSpan={cols} className="px-5 py-3"><div className="h-10 animate-pulse rounded-xl bg-[rgb(var(--vx-cell)/0.7)]" /></td></tr>
                  ))
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={cols} className="px-5 py-16 text-center">
                      <p className={cn("text-base", muted)}>{searchTerm || filtersOn ? "No students match." : "No students yet. Add one, or upload your roster from a spreadsheet."}</p>
                      {!searchTerm && !filtersOn && canManageStudents && (
                        <div className="mt-4 flex justify-center">
                          <ButtonGroup>
                            <Button onClick={(e) => { e.stopPropagation(); handleAddNew(); }}><Plus /> Add a student</Button>
                            <Button variant="secondary" onClick={(e) => { e.stopPropagation(); handleDownloadTemplate(); }}><Download /> Template</Button>
                            <Button variant="secondary" onClick={(e) => { e.stopPropagation(); handleBulkUploadClick(); }}><Upload /> Upload roster</Button>
                          </ButtonGroup>
                        </div>
                      )}
                      {filtersOn && (
                        <button type="button" onClick={() => { setFilterAssigned(""); setFilterProgress(""); setFilterGroup(""); }}
                          className="mt-2 text-base font-medium text-[rgb(var(--vx-accent-text))] hover:underline">Clear filters</button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((s) => (
                    <tr key={s.id} onClick={() => setDrawer(s)} title="Open student"
                      className={cn("group/row cursor-pointer transition-colors hover:bg-[rgb(var(--vx-accent)/0.05)]", picked[s.id] && "bg-[rgb(var(--vx-accent)/0.08)]")}>
                      <td className="py-3 pl-5 pr-0"><Tick label={`Select ${s.name}`} checked={!!picked[s.id]} onChange={(e) => togglePick(s, e)} /></td>
                      <td className="max-w-xs px-5 py-3">
                        <div className="truncate text-base font-semibold">{s.name}</div>
                        <div className={cn("flex items-center gap-0.5 text-sm", muted)}>
                          <span className="truncate">{s.email}</span>
                          <CopyButton value={s.email} label="Copy email" className="size-6 opacity-0 focus:opacity-100 group-hover/row:opacity-100" size={13} />
                        </div>
                      </td>
                      {showSchoolColumn && <td className="max-w-[14rem] truncate px-5 py-3 text-base">{s.schoolName}</td>}
                      {showGroupColumn && (
                        <td className="whitespace-nowrap px-5 py-3">
                          <span className="inline-flex items-center gap-0.5">
                            {s.groupName
                              ? <span className="inline-flex rounded-full bg-[rgb(var(--vx-accent)/0.14)] px-3 py-0.5 text-sm font-medium">{s.groupName}</span>
                              : <span className={muted}>—</span>}
                            {canManageStudents && groups.length > 0 && (
                              <Menu label="Change group" align="left" className="opacity-0 focus-within:opacity-100 group-hover/row:opacity-100" items={groupItems([s])} />
                            )}
                          </span>
                        </td>
                      )}
                      <td className="whitespace-nowrap px-5 py-3">
                        {s.progress !== "N/A" ? (
                          <div className="flex items-center gap-2.5"><MiniRing value={parseInt(s.progress, 10)} /><div>
                            <div className="text-base font-semibold tabular-nums">{s.progress} <span className={cn("font-normal", muted)}>avg</span></div>
                            <div className={cn("text-sm tabular-nums", muted)}>{s.bestScore ? `${s.bestScore} best · ` : ""}{s.totalSessions} session{s.totalSessions === 1 ? "" : "s"}</div>
                          </div></div>
                        ) : <span className={cn("text-base", muted)}>No sessions yet</span>}
                      </td>
                      {showScenariosColumn && (
                        <td className="whitespace-nowrap px-5 py-3 text-base tabular-nums">
                          {s.isAssigned ? `${s.assignedScenariosCount}` : <span className={muted}>None</span>}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-5 py-3 text-base">
                        <span className="inline-flex items-center gap-2">
                          <ActivityDot lastAt={s.lastSessionAt} />
                          <Ago date={s.lastSessionAt} fallback="—" className={cn(!s.lastSessionAt && muted)} />
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <InviteStatusCell student={s} canResend={canManageStudents} isBusy={resendingId === s.id} onResend={() => requestResend(s)} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedStudent(s.originalData || s); }}><FileText /> View</Button>
                      </td>
                      <td className={cn("whitespace-nowrap px-5 py-3 font-mono text-sm", muted)} title={s.id}>
                        <span className="inline-flex items-center gap-0.5">{s.visualId}
                          <CopyButton value={s.id} label="Copy ID" className="size-6 opacity-0 focus:opacity-100 group-hover/row:opacity-100" size={13} />
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        {canManageStudents && (
                          <RowActions items={[
                            { icon: Bell, label: "Remind", onClick: () => { window.location.href = reminder([s]); } },
                            { icon: Pencil, label: "Edit", onClick: () => handleEdit(s) },
                            { icon: Trash2, label: "Delete", danger: true, onClick: () => handleDelete(s.id) },
                          ]} />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5">
            <Pagination page={currentPage} pageSize={pageSize} total={totalItems} onPage={handlePageChange} onPageSize={setPageSize} />
          </div>
        </div>
      </div>

      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <StudentModal
            studentData={editingStudent}
            onSave={handleSaveStudent}
            onClose={() => setIsStudentModalOpen(false)}
            role={role}
            defaultSchoolName={user?.schoolName || ""}
            groups={groups}
          />
        </div>
      )}
      {drawer && (
        <StudentDrawer student={drawer} canManage={canManageStudents} onClose={() => setDrawer(null)}
          onTranscripts={() => { setSelectedStudent(drawer.originalData || drawer); }}
          onRemind={() => { window.location.href = reminder([drawer]); }}
          onEmail={() => setCompose({ students: [drawer] })}
          onAssign={showScenariosColumn ? () => { setAssignFor(drawer.name); setIsAssignModalOpen(true); } : null} />
      )}
      {compose && <ComposeEmail to={compose} fromName={user?.name} onClose={() => setCompose(null)} />}
      {groupsOpen && (
        <GroupsPanel groups={groups} onGroupsChange={setGroups} onClose={() => setGroupsOpen(false)}
          onShowGroup={(g) => { setFilterGroup(g._id); setGroupsOpen(false); }}
          onEmailGroup={(g) => setCompose({ group: g })} />
      )}
      {bulkDelete && (
        <Dialog title={`Delete ${pickedList.length} student${pickedList.length === 1 ? "" : "s"}?`} onClose={() => { setBulkDelete(false); setConfirmText(""); }} size="sm" z="z-[60]"
          footer={
            <ButtonGroup>
              <Button variant="secondary" size="lg" onClick={() => { setBulkDelete(false); setConfirmText(""); }}>Cancel</Button>
              <Button variant="destructive" size="lg" disabled={confirmText.trim().toLowerCase() !== "delete" || bulkBusy} onClick={deleteMany}>
                {bulkBusy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
              </Button>
            </ButtonGroup>
          }>
          <div className="flex flex-col gap-3">
            <p className={cn("text-base", muted)}>Their accounts are removed and they can no longer sign in. This cannot be undone.</p>
            <p className="text-base">{pickedList.slice(0, 5).map((r) => r.name).join(", ")}{pickedList.length > 5 ? ` and ${pickedList.length - 5} more` : ""}</p>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Type <span className="font-mono">delete</span> to confirm
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus
                className="h-11 rounded-xl border-0 bg-[rgb(var(--vx-cell))] px-3 text-base outline-none focus:ring-2 focus:ring-[rgb(var(--vx-danger))]" />
            </label>
          </div>
        </Dialog>
      )}
      {isAssignModalOpen && showScenariosColumn && (
        <AssignScenariosModal
          focusStudent={assignFor}
          onClose={() => { setIsAssignModalOpen(false); setAssignFor(""); }}
          onAssignSuccess={() => {
            fetchStudents();
            toast.success("Scenarios assigned successfully");
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("scenarioAssignmentsChanged"),
              );
            }
          }}
        />
      )}
      {selectedStudent && (
        <TranscriptViewerModal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          student={selectedStudent}
        />
      )}

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={() => {
          onConfirmAction();
          setIsConfirmModalOpen(false);
        }}
        title={confirmTitle}
        message={confirmMessage}
      />
    </div>
  );
}

export default StudentPage;
