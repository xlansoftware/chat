---
title: filesystem tools - branch
---
--- message ---
role: user
---
what tools do you have available? list the names along with a description of what they do2

--- message ---
role: assistant
---
Here are the tools I have available, along with their descriptions:

1. **read_text_file**: Reads the complete contents of a file from the file system as text. Handles various text encodings and provides detailed error messages if the file cannot be read.

2. **read_media_file**: Reads an image or audio file and returns the base64 encoded data and MIME type.

3. **read_multiple_files**: Reads the contents of multiple files simultaneously, which is more efficient than reading files one by one when you need to analyze or compare multiple files.

4. **write_file**: Creates a new file or completely overwrites an existing file with new content.

5. **edit_file**: Makes line-based edits to a text file. Each edit replaces exact line sequences with new content and returns a git-style diff showing the changes made.

6. **create_directory**: Creates a new directory or ensures a directory exists. Can create multiple nested directories in one operation.

7. **list_directory**: Gets a detailed listing of all files and directories in a specified path, clearly distinguishing between them.

8. **list_directory_with_sizes**: Gets a detailed listing of all files and directories in a specified path, including their sizes.

9. **directory_tree**: Gets a recursive tree view of files and directories as a JSON structure, showing the hierarchy.

10. **move_file**: Moves or renames files and directories. Can move files between directories or rename them.

11. **search_files**: Recursively searches for files and directories matching a pattern (e.g., `*.txt` or `**/*.pdf`).

12. **get_file_info**: Retrieves detailed metadata about a file or directory, such as size, creation time, last modified time, permissions, and type.

13. **list_allowed_directories**: Returns the list of directories that this server is allowed