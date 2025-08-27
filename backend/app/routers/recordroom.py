# routers/recordroom.py
@router.post("/issue", response_model=FileMovementOut)
def issue(payload: FileMovementIssueIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    # close any open movement
    db.execute(sa.update(FileMovement).where(FileMovement.file_id==payload.file_id, FileMovement.returned_at.is_(None)).values(returned_at=sa.func.now()))
    mv = FileMovement(file_id=payload.file_id, issued_to=payload.issued_to, remarks=payload.remarks)
    db.add(mv); db.commit(); db.refresh(mv); return mv

@router.post("/return/{movement_id}", response_model=FileMovementOut)
def return_file(movement_id: int, payload: FileMovementReturnIn, db: Session = Depends(get_db), _: User = Depends(require_roles(RoleEnum.admin, RoleEnum.operator))):
    mv = db.get(FileMovement, movement_id) or HTTPException(404, "Not found")
    mv.returned_at = sa.func.now(); 
    if payload.remarks: mv.remarks = (mv.remarks or "") + f"\nReturn: {payload.remarks}"
    db.add(mv); db.commit(); db.refresh(mv); return mv
