using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SafetyCount.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeEIdColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EId",
                table: "Employees",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EId",
                table: "Employees");
        }
    }
}
