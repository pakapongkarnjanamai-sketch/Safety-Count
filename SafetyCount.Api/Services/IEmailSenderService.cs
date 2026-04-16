using SafetyCount.Api.DTOs;

namespace SafetyCount.Api.Services;

public interface IEmailSenderService
{
    Task SendAsync(EmailNotificationRequestDto request, CancellationToken cancellationToken = default);
}