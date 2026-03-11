async function addUrl() {

  if (!newUrl) return

  const { data: userData } = await supabase.auth.getUser()

  const user = userData.user

  if (!user) return

  const { error } = await supabase
    .from("urls")
    .insert({
      url: newUrl,
      schedule_type: schedule,
      user_id: user.id,
      next_capture: new Date()
    })

  if (error) {
    console.error("Error adding URL:", error)
    return
  }

  setNewUrl("")

  fetchUrls()
}
