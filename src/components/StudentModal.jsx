import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { X, ChevronDown, Loader2, Plus } from "lucide-react";
import { Button, ButtonGroup, Segmented, InputGroup, InputCell, controlClass } from "./vx/ui";
import { cn } from "../lib/utils";
import { Select } from "./vx/bits";

function StudentModal({
  onSave,
  onClose,
  studentData,
  role,
  defaultSchoolName,
  groups = [],
}) {
  const isEdit = !!studentData;
  // Educators and school admins are scoped to one school and the API derives the
  // school from their own account, so the field is not theirs to choose.
  const schoolIsFixed = role === "educator" || role === "school_admin";
  // Groups are a per-school grouping of students; both scoped roles manage them.
  const canAssignGroup = role === "educator" || role === "school_admin";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groupMode, setGroupMode] = useState(
    studentData?.groupId ? "existing" : "none",
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: isEdit
      ? {
          studentName: studentData.name,
          emailAddress: studentData.email,
          schoolName: studentData.schoolName,
          grade: "",
          groupId: studentData.groupId?._id || studentData.groupId || "",
          newGroupName: "",
        }
      : {
          studentName: "",
          emailAddress: "",
          schoolName: schoolIsFixed ? defaultSchoolName : "",
          grade: "",
          groupId: "",
          newGroupName: "",
        },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    const submissionData = {
      id: studentData?.id,
      user_id: studentData?.user_id,
      name: data.studentName,
      email: data.emailAddress,
      schoolName:
        !isEdit && schoolIsFixed ? defaultSchoolName : data.schoolName,
      grade: data.grade,
    };

    if (canAssignGroup) {
      if (groupMode === "new" && data.newGroupName?.trim()) {
        submissionData.newGroupName = data.newGroupName.trim();
      } else {
        // Send null rather than omitting it, so picking "No group" on an existing
        // student actually removes them from their group.
        submissionData.groupId =
          groupMode === "existing" ? data.groupId || null : null;
      }
    }

    await onSave(submissionData);
    setIsSubmitting(false);
  };

  const err = errors.studentName?.message || errors.emailAddress?.message;
  const nameField = register("studentName", { required: "Add the student's name." });
  const emailField = register("emailAddress", {
    required: "Add an email address.",
    pattern: { value: /\S+@\S+\.\S+/, message: "That email address doesn't look right." },
  });

  return (
    <div className="vx flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-[rgb(var(--vx-bg))] text-[rgb(var(--vx-ink))] shadow-2xl">
      <div className="flex items-center justify-between gap-3 px-6 pb-2 pt-6">
        <h2 className="text-2xl font-semibold tracking-tight">{isEdit ? "Edit student" : "New student"}</h2>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid size-10 place-items-center rounded-full text-[rgb(var(--vx-muted))] transition-colors hover:bg-[rgb(var(--vx-cell))] hover:text-[rgb(var(--vx-ink))]">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 overflow-y-auto px-6 pb-6 pt-3">
        <div className="flex flex-col gap-2">
          <InputGroup vertical>
            <InputCell label="Full name" htmlFor="st-name" className={cn(errors.studentName && "bg-[rgb(var(--vx-danger)/0.08)]")}>
              <input id="st-name" type="text" autoFocus autoComplete="off" {...nameField} placeholder="e.g. Tatiana Baptista" className={cn(controlClass, "text-lg")} />
            </InputCell>
            <InputCell label="Email" htmlFor="st-email" className={cn(errors.emailAddress && "bg-[rgb(var(--vx-danger)/0.08)]")}>
              <input id="st-email" type="email" autoComplete="off" {...emailField} placeholder="name@example.com" className={cn(controlClass, "text-lg")} />
            </InputCell>
            {!(schoolIsFixed && !isEdit) && (
              <InputCell label="School" htmlFor="st-school">
                <input id="st-school" type="text" {...register("schoolName")} readOnly={schoolIsFixed} placeholder="School name"
                  className={cn(controlClass, "text-lg", schoolIsFixed && "text-[rgb(var(--vx-muted))]")} />
              </InputCell>
            )}
          </InputGroup>
          {err && <p role="alert" className="px-1 text-sm text-[rgb(var(--vx-danger))]">{err}</p>}
          {!isEdit && <p className="px-1 text-sm text-[rgb(var(--vx-muted))]">We email them their login details.</p>}
        </div>

        {canAssignGroup && (
          <div className="flex flex-col gap-2">
            <span className="px-1 text-base font-semibold">Group</span>
            <Segmented label="Group" value={groupMode} onChange={setGroupMode}
              options={[{ value: "none", label: "None" }, { value: "existing", label: "Existing" }, { value: "new", label: "New group" }]} />
            {groupMode === "existing" && (groups.length === 0 ? (
              <p className="px-1 text-sm text-[rgb(var(--vx-muted))]">No groups yet. Pick New group to make one.</p>
            ) : (
              <InputGroup vertical>
                <InputCell label="Which group" htmlFor="st-group">
                  <Select variant="ghost" label="Which group" value={watch("groupId") || ""} onChange={(v) => setValue("groupId", v, { shouldDirty: true })}
                    placeholder="Choose a group" className="-mx-4 w-[calc(100%+2rem)] [&>button]:text-lg"
                    options={groups.map((g) => ({ value: g._id, label: g.name, hint: g.studentCount != null ? `${g.studentCount}` : undefined }))} />
                </InputCell>
              </InputGroup>
            ))}
            {groupMode === "new" && (
              <InputGroup vertical>
                <InputCell label="New group name" htmlFor="st-newgroup">
                  <input id="st-newgroup" type="text" autoComplete="off" {...register("newGroupName")} placeholder="e.g. Morning Cohort A" className={cn(controlClass, "text-lg")} />
                </InputCell>
              </InputGroup>
            )}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <ButtonGroup>
            <Button variant="secondary" size="lg" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="animate-spin" /> Saving</> : isEdit ? "Save changes" : <><Plus /> Add student</>}
            </Button>
          </ButtonGroup>
        </div>
      </form>
    </div>
  );
}

export default StudentModal;
