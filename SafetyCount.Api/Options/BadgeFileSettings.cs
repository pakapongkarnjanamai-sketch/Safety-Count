namespace SafetyCount.Api.Options;

public class BadgeFileSettings
{
    public const string SectionName = "BadgeFileSettings";

    public string ShareDirectory { get; set; } = string.Empty;
}