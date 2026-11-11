const shortDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric"
});
const weekdayDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric"
});
const hmsTimeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});
const intFmt = new Intl.NumberFormat("en-US").format;
export {
  hmsTimeFmt,
  intFmt,
  shortDateFmt,
  weekdayDateFmt
};
