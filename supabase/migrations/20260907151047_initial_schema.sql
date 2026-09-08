CREATE SEQUENCE IF NOT EXISTS daily_diagnose_data_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS daily_reports_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS health_check_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS scheduled_tasks_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS task_execution_logs_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS users_id_seq START WITH 1 INCREMENT BY 1;
CREATE TABLE public.daily_diagnose_data (
  id int4 NOT NULL DEFAULT nextval('daily_diagnose_data_id_seq'::regclass),
  diagnose_time timestamptz NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'normal'::character varying,
  created_at timestamptz NOT NULL DEFAULT now(),
  camera_id text,
  site_name_watermark text,
  camera_status varchar(50) DEFAULT '正常'::character varying,
  camera_abnormal_desc text DEFAULT '正常'::text,
  risk_items jsonb,
  capture_time timestamptz,
  image_url text,
  PRIMARY KEY (id)
);
ALTER SEQUENCE daily_diagnose_data_id_seq OWNED BY public.daily_diagnose_data.id;
CREATE INDEX IF NOT EXISTS daily_diagnose_data_diagnose_time_idx ON public.daily_diagnose_data USING btree (diagnose_time);
CREATE INDEX IF NOT EXISTS daily_diagnose_data_status_idx ON public.daily_diagnose_data USING btree (status);
CREATE INDEX IF NOT EXISTS daily_diagnose_data_created_at_idx ON public.daily_diagnose_data USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_daily_diagnose_camera_id ON public.daily_diagnose_data USING btree (camera_id);
CREATE INDEX IF NOT EXISTS idx_daily_diagnose_site_name ON public.daily_diagnose_data USING btree (site_name_watermark);
CREATE INDEX IF NOT EXISTS idx_daily_diagnose_camera_status ON public.daily_diagnose_data USING btree (camera_status);
CREATE INDEX IF NOT EXISTS idx_daily_diagnose_capture_time ON public.daily_diagnose_data USING btree (capture_time);
CREATE TABLE public.daily_reports (
  id int4 NOT NULL DEFAULT nextval('daily_reports_id_seq'::regclass),
  report_date varchar(10) NOT NULL,
  excel_url text NOT NULL DEFAULT ''::text,
  file_name varchar(255),
  total_count int4 NOT NULL DEFAULT 0,
  abnormal_count int4 NOT NULL DEFAULT 0,
  normal_count int4 NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER SEQUENCE daily_reports_id_seq OWNED BY public.daily_reports.id;
CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_report_date_key ON public.daily_reports USING btree (report_date);
CREATE INDEX IF NOT EXISTS daily_reports_report_date_idx ON public.daily_reports USING btree (report_date);
CREATE TABLE public.health_check (
  id int4 NOT NULL DEFAULT nextval('health_check_id_seq'::regclass),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER SEQUENCE health_check_id_seq OWNED BY public.health_check.id;
CREATE TABLE public.scheduled_tasks (
  id int4 NOT NULL DEFAULT nextval('scheduled_tasks_id_seq'::regclass),
  name varchar(255) NOT NULL,
  bot_id varchar(255),
  cron_expression varchar(100) NOT NULL,
  prompt_template text NOT NULL DEFAULT ''::text,
  is_active bool NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  task_type varchar(20) NOT NULL DEFAULT 'bot'::character varying,
  workflow_parameters text NOT NULL DEFAULT ''::text,
  workflow_id varchar(255),
  PRIMARY KEY (id)
);
ALTER SEQUENCE scheduled_tasks_id_seq OWNED BY public.scheduled_tasks.id;
CREATE TABLE public.task_execution_logs (
  id int4 NOT NULL DEFAULT nextval('task_execution_logs_id_seq'::regclass),
  task_id int4 NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'running'::character varying,
  prompt_sent text,
  response_content text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (id)
);
ALTER SEQUENCE task_execution_logs_id_seq OWNED BY public.task_execution_logs.id;
CREATE TABLE public.users (
  id int4 NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  username varchar(100) NOT NULL,
  password_hash text NOT NULL,
  name varchar(100) NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'employee'::character varying,
  is_active bool NOT NULL DEFAULT true,
  token_version int4 NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER SEQUENCE users_id_seq OWNED BY public.users.id;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON public.users USING btree (username);
ALTER TABLE public.daily_diagnose_data ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.daily_diagnose_data FROM anon, authenticated;
GRANT ALL ON TABLE public.daily_diagnose_data TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.daily_diagnose_data_id_seq TO service_role;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.daily_reports FROM anon, authenticated;
GRANT ALL ON TABLE public.daily_reports TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.daily_reports_id_seq TO service_role;
ALTER TABLE public.health_check ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.health_check FROM anon, authenticated;
GRANT ALL ON TABLE public.health_check TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.health_check_id_seq TO service_role;
ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scheduled_tasks FROM anon, authenticated;
GRANT ALL ON TABLE public.scheduled_tasks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.scheduled_tasks_id_seq TO service_role;
ALTER TABLE public.task_execution_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.task_execution_logs FROM anon, authenticated;
GRANT ALL ON TABLE public.task_execution_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.task_execution_logs_id_seq TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.users FROM anon, authenticated;
GRANT ALL ON TABLE public.users TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.users_id_seq TO service_role;
