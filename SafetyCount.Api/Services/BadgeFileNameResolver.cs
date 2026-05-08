using System.Globalization;

namespace SafetyCount.Api.Services;

public static class BadgeFileNameResolver
{
    private const string BadgeFileDateFormat = "ddMMMyy";

    public static string ResolveFileName(string? fileName, DateTime? fallbackDate = null)
    {
        if (!string.IsNullOrWhiteSpace(fileName))
        {
            return Path.GetFileName(fileName.Trim());
        }

        return BuildFileName((fallbackDate ?? DateTime.Today).Date);
    }

    public static DateTime ResolveAttendanceDate(string? fileName, DateTime? fallbackDate = null)
    {
        return TryParseAttendanceDate(fileName, out var attendanceDate)
            ? attendanceDate.Date
            : (fallbackDate ?? DateTime.Today).Date;
    }

    public static bool TryParseAttendanceDate(string? fileName, out DateTime attendanceDate)
    {
        attendanceDate = default;

        if (string.IsNullOrWhiteSpace(fileName))
        {
            return false;
        }

        var fileStem = Path.GetFileNameWithoutExtension(fileName.Trim());
        if (string.IsNullOrWhiteSpace(fileStem))
        {
            return false;
        }

        return DateTime.TryParseExact(
            fileStem,
            BadgeFileDateFormat,
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out attendanceDate);
    }

    public static string BuildFileName(DateTime attendanceDate)
    {
        return $"{attendanceDate:ddMMMyy}".ToUpperInvariant() + ".TAF";
    }
}