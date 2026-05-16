from ingest import ingest_repo


def main():

    repo_url = input("Enter GitHub Repo URL: ")

    ingest_repo(repo_url)


if __name__ == "__main__":
    main()