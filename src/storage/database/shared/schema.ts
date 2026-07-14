import { pgTable, serial, timestamp, text, varchar, index } from "drizzle-orm/pg-core"

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const dailyDiagnoseData = pgTable(
	"daily_diagnose_data",
	{
		id: serial().primaryKey(),
		diagnose_time: timestamp("diagnose_time", { withTimezone: true }).notNull(),
		image_url: text("image_url").notNull(),
		diagnosis_result: text("diagnosis_result").notNull(),
		status: varchar("status", { length: 20 }).notNull().default("normal"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("daily_diagnose_data_diagnose_time_idx").on(table.diagnose_time),
		index("daily_diagnose_data_status_idx").on(table.status),
		index("daily_diagnose_data_created_at_idx").on(table.created_at),
	]
);
