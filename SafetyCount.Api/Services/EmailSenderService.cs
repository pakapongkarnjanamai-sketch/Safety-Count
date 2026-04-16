using System.Net.Mail;
using Microsoft.Extensions.Options;
using SafetyCount.Api.DTOs;
using SafetyCount.Api.Options;

namespace SafetyCount.Api.Services;

public class EmailSenderService(IHttpClientFactory httpClientFactory, IOptions<EmailSettings> emailOptions) : IEmailSenderService
{
    public async Task SendAsync(EmailNotificationRequestDto request, CancellationToken cancellationToken = default)
    {
        var settings = emailOptions.Value;
        if (string.IsNullOrWhiteSpace(settings.MailServiceUrl))
        {
            throw new InvalidOperationException("EmailSettings:MailServiceUrl is not configured.");
        }

        var recipients = request.Recipients
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .ToList();

        if (!string.IsNullOrWhiteSpace(request.To))
        {
            recipients.Add(request.To.Trim());
        }

        recipients = recipients
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (recipients.Count == 0)
        {
            throw new InvalidOperationException("At least one recipient is required.");
        }

        var sender = string.IsNullOrWhiteSpace(request.Sender)
            ? settings.DefaultSender?.Trim() ?? string.Empty
            : request.Sender.Trim();

        // Fallback to first recipient when sender is not configured as an email.
        if (!IsValidEmail(sender) && recipients.Count > 0)
        {
            sender = recipients[0];
        }

        if (!IsValidEmail(sender))
        {
            throw new ArgumentException("Sender must be a valid email address.");
        }

        using var content = new MultipartFormDataContent();
        content.Add(new StringContent(sender), "sender");

        foreach (var recipient in recipients)
        {
            content.Add(new StringContent(recipient), "recipients");
        }

        foreach (var cc in request.Cc?.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()) ?? [])
        {
            content.Add(new StringContent(cc), "cc");
        }

        foreach (var bcc in request.Bcc?.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()) ?? [])
        {
            content.Add(new StringContent(bcc), "bcc");
        }

        content.Add(new StringContent(request.Subject.Trim()), "subject");
        content.Add(new StringContent(request.Body), "body");
        content.Add(new StringContent(request.IsBodyHtml ? "true" : "false"), "isBodyHtml");

        foreach (var attachment in request.Attachments.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()))
        {
            if (!File.Exists(attachment))
            {
                throw new FileNotFoundException($"Attachment file was not found: {attachment}", attachment);
            }

            var fileBytes = await File.ReadAllBytesAsync(attachment, cancellationToken);
            if (fileBytes.Length >= 100000000)
            {
                throw new InvalidOperationException($"Attachment exceeds size limit: {attachment}");
            }

            var fileContent = new ByteArrayContent(fileBytes);
            content.Add(fileContent, "attachments", Path.GetFileName(attachment));
        }

        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(settings.TimeoutSeconds <= 0 ? 100 : settings.TimeoutSeconds);

        using var response = await client.PostAsync(settings.MailServiceUrl, content, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            var detail = string.IsNullOrWhiteSpace(responseBody)
                ? "No response body returned from mail service."
                : responseBody.Trim();

            throw new HttpRequestException(
                $"Mail service returned {(int)response.StatusCode} ({response.StatusCode}). Detail: {detail}",
                null,
                response.StatusCode);
        }
    }

    private static bool IsValidEmail(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        return MailAddress.TryCreate(value, out _);
    }
}