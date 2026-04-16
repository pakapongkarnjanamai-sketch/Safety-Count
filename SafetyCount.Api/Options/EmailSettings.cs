namespace SafetyCount.Api.Options;

public class EmailSettings
{
    public const string SectionName = "EmailSettings";

    public string MailServiceUrl { get; set; } = "https://ap-ntc2137-prwb/Utility/MailService/api/Email/Send";

    public string DefaultSender { get; set; } = "Safety Count";

    public int TimeoutSeconds { get; set; } = 100;
}