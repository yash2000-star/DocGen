import { supabase } from './auth';

// Fetch the user's specific role for a given project
export async function getUserRole(projectId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'viewer'; // Default fallback

    const { data } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single();
        
    return data?.role || 'viewer';
}

// Fetch all projects for the current logged-in user
export async function getUserProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
}

// Create a new project row (call this BEFORE /api/github)
export async function createProject(projectData) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('projects')
    .insert({ ...projectData, user_id: user.id, status: 'pending' })
    .select()
    .single();
  return { data, error };
}

// Update project status — call this after build completes
export async function updateProjectStatus(projectId, status, fileCount) {
  const { error } = await supabase
    .from('projects')
    .update({ status, file_count: fileCount, updated_at: new Date() })
    .eq('id', projectId);
  return { error };
}

// Delete a project and all its data
export async function deleteProject(projectId) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);
  return { error };
}