from datetime import timedelta
from temporalio import workflow

# Import the activity via string name to avoid circular imports or sandbox issues
# Or just use the activity itself if it's imported correctly
with workflow.unsafe.imports_passed_through():
    from activities.sql_activities import execute_sql_activity

@workflow.defn
class ExecuteSQLWorkflow:
    @workflow.run
    async def run(self, query: str) -> bytes:
        print(f">>> [Workflow] Starting execution for query: {query[:50]}...")
        result = await workflow.execute_activity(
            execute_sql_activity,
            query,
            start_to_close_timeout=timedelta(seconds=30),
        )
        print(f">>> [Workflow] Finished.")
        return result
