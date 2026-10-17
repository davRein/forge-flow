import styled from 'styled-components';

import {
    CloseButton,
    Field,
    FormActions,
    FormGrid,
    FormHeader,
    Input,
    PrimaryButton,
    Required,
    SecondaryButton
} from '../styles/projectStyles';

const ModalBackdrop = styled.div`
    position: fixed;
    inset: 0;

    display: flex;
    align-items: center;
    justify-content: center;

    background: rgba(0, 0, 0, 0.55);

    z-index: 100;
`;

const Modal = styled.div`
    width: 720px;
    max-width: calc(100vw - 40px);

    background: ${({ theme }) => theme.colors.header};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 14px;

    padding: 22px;
`;

type Props = {
    name: string;
    setName: (value: string) => void;

    street: string;
    setStreet: (value: string) => void;

    city: string;
    setCity: (value: string) => void;

    country: string;
    setCountry: (value: string) => void;

    email: string;
    setEmail: (value: string) => void;

    website: string;
    setWebsite: (value: string) => void;

    phone: string;
    setPhone: (value: string) => void;

    industry: string;
    setIndustry: (value: string) => void;

    onSave: () => void;
    onClose: () => void;
};

export default function CustomerModal({
                                          name,
                                          setName,
                                          street,
                                          setStreet,
                                          city,
                                          setCity,
                                          country,
                                          setCountry,
                                          email,
                                          setEmail,
                                          website,
                                          setWebsite,
                                          phone,
                                          setPhone,
                                          industry,
                                          setIndustry,
                                          onSave,
                                          onClose
                                      }: Props) {
    return (
        <ModalBackdrop>
            <Modal>
                <FormHeader>
                    <h2>Neuer Kunde</h2>

                    <CloseButton onClick={onClose}>
                        ×
                    </CloseButton>
                </FormHeader>

                <FormGrid>
                    <Field>
                        Name des Kunden <Required>*</Required>
                        <Input
                            value={name}
                            onChange={(event) =>
                                setName(event.target.value)
                            }
                        />
                    </Field>

                    <Field>
                        Straße + Nr. <Required>*</Required>
                        <Input
                            value={street}
                            onChange={(event) =>
                                setStreet(event.target.value)
                            }
                        />
                    </Field>

                    <Field>
                        Ort <Required>*</Required>
                        <Input
                            value={city}
                            onChange={(event) =>
                                setCity(event.target.value)
                            }
                        />
                    </Field>

                    <Field>
                        Land <Required>*</Required>
                        <Input
                            value={country}
                            onChange={(event) =>
                                setCountry(event.target.value)
                            }
                        />
                    </Field>

                    <Field>
                        E-Mail <Required>*</Required>
                        <Input
                            type="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                        />
                    </Field>

                    <Field>
                        Internetadresse
                        <Input
                            value={website}
                            onChange={(event) =>
                                setWebsite(event.target.value)
                            }
                        />
                    </Field>

                    <Field>
                        Telefonnummer <Required>*</Required>
                        <Input
                            value={phone}
                            onChange={(event) =>
                                setPhone(event.target.value)
                            }
                        />
                    </Field>

                    <Field>
                        Branche <Required>*</Required>
                        <Input
                            value={industry}
                            onChange={(event) =>
                                setIndustry(event.target.value)
                            }
                        />
                    </Field>
                </FormGrid>

                <FormActions>
                    <SecondaryButton type="button" onClick={onClose}>
                        Abbrechen
                    </SecondaryButton>

                    <PrimaryButton type="button" onClick={onSave}>
                        Speichern
                    </PrimaryButton>
                </FormActions>
            </Modal>
        </ModalBackdrop>
    );
}