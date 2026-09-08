import { pgTable, serial, timestamp, text, varchar, jsonb, boolean, integer, index } from "drizzle-orm/pg-core"

export const users = pgTable(
	"users",
	{
		id: serial().primaryKey(),
		username: varchar("username", { length: 100 }).notNull().unique(),
		password_hash: text("password_hash").notNull(),
		name: varchar("name", { length: 100 }).notNull(),
		role: varchar("role", { length: 20 }).notNull().default("employee"),
		is_active: boolean("is_active").notNull().default(true),
		token_version: integer("token_version").notNull().default(1),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	}
);

export const healthCheck = pgTable("health_check", {
	id: serial().primaryKey(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const dailyDiagnoseData = pgTable(
	"daily_diagnose_data",
	{
		id: serial().primaryKey(),
		diagnose_time: timestamp("diagnose_time", { withTimezone: true }).notNull(),
		camera_id: text("camera_id"),
		site_name_watermark: text("site_name_watermark"),
		camera_status: varchar("camera_status", { length: 50 }).default("正常"),
		camera_abnormal_desc: text("camera_abnormal_desc").default("正常"),
		risk_items: jsonb("risk_items"),
		capture_time: timestamp("capture_time", { withTimezone: true }),
		image_url: text("image_url"),
		status: varchar("status", { length: 20 }).notNull().default("normal"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("daily_diagnose_data_diagnose_time_idx").on(table.diagnose_time),
		index("daily_diagnose_data_status_idx").on(table.status),
		index("idx_daily_diagnose_camera_id").on(table.camera_id),
		index("idx_daily_diagnose_capture_time").on(table.capture_time),
		index("idx_daily_diagnose_site_name").on(table.site_name_watermark),
		index("idx_daily_diagnose_camera_status").on(table.camera_status),
		index("daily_diagnose_data_created_at_idx").on(table.created_at),
	]
);

export const scheduledTasks = pgTable(
	"scheduled_tasks",
	{
		id: serial().primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		task_type: varchar("task_type", { length: 20 }).notNull().default("bot"),
		bot_id: varchar("bot_id", { length: 255 }),
		workflow_id: varchar("workflow_id", { length: 255 }),
		cron_expression: varchar("cron_expression", { length: 100 }).notNull(),
		prompt_template: text("prompt_template").notNull().default(""),
		workflow_parameters: text("workflow_parameters").notNull().default(""),
		is_active: boolean("is_active").notNull().default(true),
		last_run_at: timestamp("last_run_at", { withTimezone: true }),
		next_run_at: timestamp("next_run_at", { withTimezone: true }),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	}
);

export const dailyReports = pgTable(
	"daily_reports",
	{
		id: serial().primaryKey(),
		report_date: varchar("report_date", { length: 10 }).notNull().unique(),
		excel_url: text("excel_url").notNull().default(""),
		file_name: varchar("file_name", { length: 255 }),
		total_count: integer("total_count").notNull().default(0),
		abnormal_count: integer("abnormal_count").notNull().default(0),
		normal_count: integer("normal_count").notNull().default(0),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("daily_reports_report_date_idx").on(table.report_date),
	]
);

export const taskExecutionLogs = pgTable(
	"task_execution_logs",
	{
		id: serial().primaryKey(),
		task_id: integer("task_id").notNull(),
		status: varchar("status", { length: 50 }).notNull().default("running"),
		prompt_sent: text("prompt_sent"),
		response_content: text("response_content"),
		error_message: text("error_message"),
		started_at: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
		completed_at: timestamp("completed_at", { withTimezone: true }),
	}
);
