#!/usr/bin/env python3
"""
Deployment script for RPStory.

This script automates:
1. Version bumping in src/html/template.html
2. Building index.html
3. Running tests
4. Committing, tagging, and pushing changes in rpstory repo
5. Deploying to the GitHub Pages repository
"""

import os
import re
import subprocess
import sys
import shutil

def run_command(command, cwd=None, error_msg=None):
    """Run a shell command and exit on failure."""
    try:
        subprocess.run(command, cwd=cwd, check=True)
    except subprocess.CalledProcessError as e:
        if error_msg:
            print(f"Error: {error_msg}")
        else:
            print(f"Command failed: {' '.join(command)}")
        sys.exit(1)

def bump_version(filepath):
    """
    Increment the patch version in the specified file.
    Expects format like 'v1.0.9'
    Returns the new version string.
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Regex to find version string
        version_pattern = r'v(\d+)\.(\d+)\.(\d+)'
        match = re.search(version_pattern, content)
        
        if not match:
            print(f"Error: Could not find version string in {filepath}")
            sys.exit(1)
        
        old_version = match.group(0)
        major, minor, patch = match.groups()
        new_patch = int(patch) + 1
        new_version = f"v{major}.{minor}.{new_patch}"
        
        new_content = content.replace(old_version, new_version)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"Version bumped from {old_version} to {new_version}")
        return new_version
    except Exception as e:
        print(f"Error bumping version: {e}")
        sys.exit(1)

def main():
    # Configuration
    template_path = 'src/html/template.html'
    target_repo_dir = '../michael-f-ellis.github.io'
    target_sub_dir = 'rpstory'
    
    # 0. Ensure we are in the right directory
    if not os.path.exists(template_path):
        print(f"Error: Run this script from the root of the rpstory repository.")
        sys.exit(1)

    # 1. Bump version
    print("Bumping version...")
    new_version = bump_version(template_path)

    # 2. Build
    print("Building index.html...")
    run_command([sys.executable, 'build.py'], error_msg="Build failed.")

    # 3. Test
    print("Running tests...")
    run_command(['npx', 'playwright', 'test'], error_msg="Tests failed. Aborting deployment.")

    # 4. Git Operations in rpstory
    print("Committing and tagging in rpstory...")
    run_command(['git', 'add', '.'])
    run_command(['git', 'commit', '-m', f"Bump version to {new_version}"])
    run_command(['git', 'push'])
    run_command(['git', 'tag', new_version])
    run_command(['git', 'push', 'origin', new_version])

    # 5. Deploy to GitHub Pages repo
    print(f"Deploying to {target_repo_dir}/{target_sub_dir}...")
    
    # Ensure destination exists
    destination_path = os.path.join(target_repo_dir, target_sub_dir)
    os.makedirs(destination_path, exist_ok=True)
    
    # Copy index.html
    shutil.copy2('index.html', os.path.join(destination_path, 'index.html'))
    print("Copied index.html to deployment target.")

    # Git update in GitHub Pages repo
    cwd = os.getcwd()
    try:
        os.chdir(target_repo_dir)
        print("Committing and pushing to GitHub Pages...")
        run_command(['git', 'add', target_sub_dir])
        # Use check=False for commit in case there are no changes (rare but possible)
        subprocess.run(['git', 'commit', '-m', f"Update rpstory to {new_version}"], check=False)
        run_command(['git', 'push'])
        print("Successfully deployed to GitHub Pages.")
    finally:
        os.chdir(cwd)

    print(f"\nDeployment of {new_version} complete!")

if __name__ == '__main__':
    main()
