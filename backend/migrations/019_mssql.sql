ALTER TABLE [dbo].[kp_project_milestones] ALTER COLUMN [bar_text] nvarchar(max) NOT NULL;
INSERT INTO [dbo].[kp_schema_migrations]([version]) VALUES(19);
