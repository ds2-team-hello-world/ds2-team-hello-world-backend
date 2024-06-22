# Step 1: Create a new orphan branch
git checkout --orphan temp-branch

# Step 2: Add all files to the new orphan branch
git add -A

# Step 3: Commit the changes with the message "init"
git commit -m "init"

# Step 4: Delete the old main branch
git branch -D main

# Step 5: Rename the current branch to main
git branch -m main

# Step 6: Force push the new main branch to the remote repository
git push -f origin main
