import { getAccessToken } from "../lib/authToken.js";
import { fetchCached, useData } from "../lib/query";
import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { Plus, Pencil, Trash2, Upload, Download, Loader2, FileSpreadsheet, Mail, ArrowUp, ArrowDown } from "lucide-react";
import { Button, ButtonGroup, RowActions } from "./vx/ui";
import { ListToolbar, Pagination } from "./vx/list";
import { CopyButton, Ago, Select, downloadCsv } from "./vx/bits";
import { cn } from "../lib/utils";
import "./vx/vx.css";

import {
  ACCEPTED_EXTENSIONS,
  buildTemplateWorkbook,
  buildUserPayload,
  readRows,
  templateFilename,
} from "../lib/bulkUsers";

import EducatorModal from "./EducatorModal";
import ConfirmationModal from "./ui/ConfirmationModal.jsx";
import { toast } from "react-hot-toast";
import { useAuth } from "../AuthContext";
import { useLoading } from "../lib/hooks/useLoading";

const getAuthHeaders = () => {
  const token = getAccessToken();
  return { headers: { Authorization: `Bearer ${token}` } };
};

function EducatorsPage() {
  const { user } = useAuth();
  const [educators, setEducators] = useState([]);
  const { isLoading, withLoading } = useLoading(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEducator, setEditingEducator] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [onConfirmAction, setOnConfirmAction] = useState(() => {});

  const fetchEducators = async () => {
    await withLoading(async () => {
      const response = { data: await fetchCached("/api/users", { role: "educator" }) };
      const mappedData = response.data.map((user) => ({
        id: user._id,
        visualId: `VS${user._id.slice(-6).toUpperCase()}`,
        name: user.name,
        email: user.email,
        department: user.department,
      }));
      setEducators(mappedData);
    });
  };

  useEffect(() => {
    fetchEducators();
  }, []);

  const handleAddNew = () => {
    setEditingEducator(null);
    setIsModalOpen(true);
  };

  const handleBulkUploadClick = () => {
    fileInputRef.current.click();
  };

  /*
   * Hands the user the exact file the importer wants rather than describing it.
   * Shares every rule with the student importer — see lib/bulkUsers.js — so the
   * two cannot drift apart.
   */
  const handleDownloadTemplate = () => {
    XLSX.writeFile(buildTemplateWorkbook("educator"), templateFilename("educator"));
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
      parsed = buildUserPayload(await readRows(file), "educator");
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
     * in the console and said "Check console", which nobody outside this team is
     * going to do — so a failed import looked like a partial success with no
     * explanation.
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
          : "That file has the right columns but no educator rows.",
        { id: uploadToast, duration: 10000, style: { whiteSpace: "pre-line" } },
      );
      setIsUploading(false);
      clearInput();
      return;
    }

    toast.loading(`Uploading ${users.length} educators...`, { id: uploadToast });
    try {
      const response = await axios.post(
        "/api/users/bulk",
        { users, role: "educator" },
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
      await fetchEducators();
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

  const handleEdit = (educator) => {
    setEditingEducator(educator);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    setConfirmTitle("Delete Educator");
    setConfirmMessage("Are you sure you want to delete this educator?");
    setOnConfirmAction(() => async () => {
      try {
        await axios.delete(`/api/users/${id}`, getAuthHeaders());
        setEducators((prev) => prev.filter((e) => e.id !== id));
        toast.success("Educator deleted successfully");
      } catch (error) {
        toast.error(
          "Failed to delete educator: " +
            (error.response?.data?.message || error.message),
        );
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleSave = async (formData) => {
    try {
      if (formData.id) {
        await axios.put(
          `/api/users/${formData.id}`,
          {
            name: formData.educatorName,
            email: formData.emailAddress,
            department: formData.department,
          },
          getAuthHeaders(),
        );
        toast.success("Educator updated successfully");
      } else {
        await axios.post(
          "/api/users",
          {
            name: formData.educatorName,
            email: formData.emailAddress,
            role: "educator",
            department: formData.department,
            schoolId: user.schoolId,
          },
          getAuthHeaders(),
        );
        toast.success("Educator created successfully");
      }
      await fetchEducators();
      setIsModalOpen(false);
    } catch (error) {
      toast.error(
        "Error saving: " + (error.response?.data?.message || error.message),
      );
    }
  };

  // Adoption numbers per educator (GET /api/dashboard/educators-overview), merged by id.
  // Shared with the school admin dashboard's cached copy.
  const overview = useData("/api/dashboard/educators-overview", { fallback: { educators: [] } });
  const stats = React.useMemo(() => Object.fromEntries((overview?.educators || []).map((e) => [String(e._id), e])), [overview]);

  const [sort, setSort] = useState({ key: "sessions30", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const muted = "text-[rgb(var(--vx-muted))]";

  const rows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = educators
      .map((e) => ({ ...e, ...(stats[e.id] || {}), id: e.id }))
      .filter((e) => !q || `${e.name} ${e.email}`.toLowerCase().includes(q))
      .filter((e) => departmentFilter === "" || e.department === departmentFilter);
    const val = (e) => {
      const v = e[sort.key];
      if (sort.key === "lastSessionAt" || sort.key === "lastLoginAt") return v ? new Date(v).getTime() : 0;
      return typeof v === "string" ? v.toLowerCase() : v ?? -1;
    };
    return list.sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * (sort.dir === "asc" ? 1 : -1));
  }, [educators, stats, searchTerm, departmentFilter, sort]);

  useEffect(() => setPage(1), [searchTerm, departmentFilter, pageSize]);
  const shown = rows.slice((page - 1) * pageSize, page * pageSize);
  const departments = [...new Set(educators.map((e) => e.department).filter(Boolean))].sort();

  const Head = ({ k, children, right }) => (
    <th className={cn("whitespace-nowrap px-5 py-3 text-sm font-medium", muted, right ? "text-right" : "text-left")}>
      {k ? (
        <button type="button" className="inline-flex items-center gap-1 hover:text-[rgb(var(--vx-ink))]"
          onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }))}>
          {children}{sort.key === k && (sort.dir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
        </button>
      ) : children}
    </th>
  );

  const exportCsv = () => downloadCsv(`educators-${new Date().toISOString().slice(0, 10)}.csv`, [
    { label: "Name", value: (r) => r.name }, { label: "Email", value: (r) => r.email }, { label: "Department", value: (r) => r.department || "" },
    { label: "Students", value: (r) => r.students ?? "" }, { label: "Scenarios", value: (r) => r.scenarios ?? "" },
    { label: "Published", value: (r) => r.published ?? "" }, { label: "Sessions (30 days)", value: (r) => r.sessions30 ?? "" },
    { label: "Sessions (all)", value: (r) => r.sessions ?? "" }, { label: "Average score", value: (r) => (r.avgScore != null ? `${r.avgScore}%` : "") },
    { label: "Last session", value: (r) => (r.lastSessionAt ? new Date(r.lastSessionAt).toISOString().slice(0, 10) : "") },
    { label: "Last sign-in", value: (r) => (r.lastLoginAt ? new Date(r.lastLoginAt).toISOString().slice(0, 10) : "") },
  ], rows);

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="flex items-baseline gap-3 text-3xl font-semibold tracking-tight">
            Educators {educators.length > 0 && <span className={cn("tabular-nums", muted)}>{educators.length}</span>}
          </h1>
          <ButtonGroup>
            <Button variant="secondary" className="h-11" onClick={handleDownloadTemplate} title="Download the .xlsx template for bulk upload"><Download /> Template</Button>
            <Button variant="secondary" className="h-11" onClick={handleBulkUploadClick} disabled={isUploading}>
              {isUploading ? <Loader2 className="animate-spin" /> : <Upload />} {isUploading ? "Uploading" : "Upload educators"}
            </Button>
            <Button variant="secondary" className="h-11" onClick={exportCsv} disabled={!rows.length}><FileSpreadsheet /> Export</Button>
          </ButtonGroup>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept={ACCEPTED_EXTENSIONS.join(",")} className="hidden" disabled={isUploading} />
        </header>

        <ListToolbar
          search={{ value: searchTerm, onChange: setSearchTerm, placeholder: "Search name or email" }}
          filters={departments.length > 1 && (
            <div className="px-1">
              <Select variant="ghost" label="Department" value={departmentFilter} onChange={setDepartmentFilter}
                options={[{ value: "", label: "All departments" }, ...departments.map((d) => ({ value: d, label: d }))]} />
            </div>
          )}
          actions={<Button size="lg" className="h-11 rounded-[22px]" onClick={handleAddNew}><Plus /> New educator</Button>}
        />

        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-cell)/0.5)]">
                <tr>
                  <Head k="name">Educator</Head>
                  <Head k="department">Department</Head>
                  <Head k="students" right>Students</Head>
                  <Head k="scenarios" right>Scenarios</Head>
                  <Head k="sessions30" right>Sessions (30 d)</Head>
                  <Head k="lastSessionAt">Last session</Head>
                  <Head k="lastLoginAt">Last sign-in</Head>
                  <Head><span className="sr-only">Actions</span></Head>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={8} className="px-5 py-3"><div className="h-10 animate-pulse rounded-xl bg-[rgb(var(--vx-cell)/0.7)]" /></td></tr>)
                ) : shown.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-16 text-center">
                    <p className={cn("text-base", muted)}>{searchTerm || departmentFilter ? "No educators match." : "No educators yet. Add one, or upload a list from a spreadsheet."}</p>
                  </td></tr>
                ) : shown.map((e) => {
                  const quiet = stats[e.id] && !e.sessions30;
                  return (
                    <tr key={e.id} className="group/row transition-colors hover:bg-[rgb(var(--vx-accent)/0.05)]">
                      <td className="max-w-xs px-5 py-3">
                        <div className="flex items-center gap-2 text-base font-semibold">
                          <span className="truncate">{e.name}</span>
                          {quiet && <span className="shrink-0 rounded-full bg-[rgb(var(--vx-cell))] px-2 py-0.5 text-xs font-medium text-[rgb(var(--vx-muted))]" title="No sessions on their scenarios in 30 days">quiet</span>}
                        </div>
                        <div className={cn("flex items-center gap-0.5 text-sm", muted)}>
                          <span className="truncate">{e.email}</span>
                          <CopyButton value={e.email} label="Copy email" className="size-6 opacity-0 focus:opacity-100 group-hover/row:opacity-100" size={13} />
                        </div>
                      </td>
                      <td className={cn("whitespace-nowrap px-5 py-3 text-base", !e.department && muted)}>{e.department || "—"}</td>
                      <td className="px-5 py-3 text-right text-base tabular-nums">{e.students ?? "…"}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-base tabular-nums">{e.scenarios ?? "…"}{e.published != null && <span className={cn("text-sm", muted)}> · {e.published} live</span>}</td>
                      <td className="px-5 py-3 text-right text-base font-semibold tabular-nums">{e.sessions30 ?? "…"}</td>
                      <td className={cn("whitespace-nowrap px-5 py-3 text-base", !e.lastSessionAt && muted)}><Ago date={e.lastSessionAt} fallback="None yet" /></td>
                      <td className={cn("whitespace-nowrap px-5 py-3 text-base", !e.lastLoginAt && muted)}><Ago date={e.lastLoginAt} fallback="Never" /></td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <RowActions items={[
                          { icon: Mail, label: "Email", onClick: () => { window.location.href = `mailto:${e.email}`; } },
                          { icon: Pencil, label: "Edit", onClick: () => handleEdit(e) },
                          { icon: Trash2, label: "Delete", danger: true, onClick: () => handleDelete(e.id) },
                        ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5">
            <Pagination page={page} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={setPageSize} />
          </div>
        </div>
      </div>

      {isModalOpen && <EducatorModal educatorData={editingEducator} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
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

export default EducatorsPage;
